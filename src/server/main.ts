import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItemKind,
  DidChangeConfigurationNotification,
  DiagnosticSeverity,
  SymbolInformation,
  SymbolKind,
} from "vscode-languageserver/node";
import type {
  Range,
  DocumentSymbolParams,
  CodeLensParams,
  Hover,
  Diagnostic,
  InitializeParams,
  CompletionItem,
  TextDocumentPositionParams,
  InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import stateSpecialChar from "./state/specialChar";
import { Elem, Operation, State } from "./classes";
import generateDiagnostic from "./utils/generateDiagnostic";
import { inRange } from "./utils/inRange";

// --------------- Global Variables ----------------- //
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const states = new Map<string, State[]>();
const config = new Map<
  string,
  { tapes: number; initialState: string; found: boolean }
>();
let hasDiagnosticRelatedInformationCapability = false;

// --------------- Server Functions ----------------- //
connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasDiagnosticRelatedInformationCapability = Boolean(
    capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      completionProvider: {
        resolveProvider: true,
      },
      codeLensProvider: {
        resolveProvider: true,
      },
    },
  };
  return result;
});

connection.onDidChangeConfiguration((_change) => {
  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  let fileStates: State[] = [];
  let fileConfig = { tapes: 0, initialState: "", found: false };

  const diagnostics: Diagnostic[] = [];
  let nowParsingState = "";
  for (let i = 0; i < textDocument.lineCount; i++) {
    const rangeStart = textDocument.positionAt(
      textDocument.offsetAt({ line: i, character: 0 })
    );
    const rangeEnd = textDocument.positionAt(
      textDocument.offsetAt({ line: i, character: 1000 })
    );
    const lineRange: Range = { start: rangeStart, end: rangeEnd };
    const line = textDocument.getText(lineRange).replace(/\r?\n|\r/g, "");

    // Config
    if (line.startsWith("##")) {
      if (line.toLowerCase().includes("tape")) {
        const t = line.split(":");
        if (t.length === 2) {
          const tapes = parseInt(t[1].trim());
          if (isNaN(tapes) || tapes < 1) {
            diagnostics.push(
              generateDiagnostic(
                DiagnosticSeverity.Error,
                lineRange,
                `Number of tapes must be a positive integer`
              )
            );
          } else {
            fileConfig.tapes = tapes;
          }
        } else {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              lineRange,
              `Bad Configuration`
            )
          );
        }
        fileConfig.found = true;
      }
      if (line.toLowerCase().includes("initial")) {
        const t = line.split(":");
        if (t.length === 2) {
          fileConfig.initialState = t[1].trim();
        } else {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              lineRange,
              `Bad Configuration`
            )
          );
        }
        fileConfig.found = true;
      }
      continue;
    }

    // Skip comments
    if (line.startsWith("#")) {
      continue;
    }
    // Skip empty lines
    if (line.trim().length === 0) {
      continue;
    }

    // Opがなんか変だよ
    if (line.split(" - ").length > 2) {
      diagnostics.push(
        generateDiagnostic(
          DiagnosticSeverity.Error,
          lineRange,
          `The number of " - " is too much`
        )
      );
      continue;
    }

    // State
    const stateName = line.includes(" - ") ? null : line;
    if (stateName !== null) {
      nowParsingState = stateName;
      // Statename にスペース、コンマ、ハッシュ、ハイフンが含まれている
      stateSpecialChar(
        stateName,
        lineRange,
        textDocument,
        hasDiagnosticRelatedInformationCapability,
        diagnostics
      );
      // StateName 1文字は避けるべき
      if (stateName.length === 1) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Warning,
            lineRange,
            "State name should be at least 2 characters long"
          )
        );
      }
      // StateName 数字からスタート
      if (/^\d/.test(stateName)) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Warning,
            lineRange,
            "State name should not start with a number"
          )
        );
      }
      // Statename = accept or reject
      if (/^(accept|reject)$/.test(stateName)) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            lineRange,
            "This state name is reserved"
          )
        );
        continue;
      }
      fileStates.push(new State(stateName, lineRange));
    }
    // Operation
    else {
      const [cond, op] = line.split(" - ").map((s) => s.split(","));
      const state = fileStates.find((s) => s.getName() === nowParsingState);
      const condRange = {
        start: textDocument.positionAt(
          textDocument.offsetAt({ line: i, character: 0 })
        ),
        end: textDocument.positionAt(
          textDocument.offsetAt({ line: i, character: cond.join(",").length })
        ),
      };
      // State定義してない
      if (state === undefined) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            lineRange,
            "You need to define a state first"
          )
        );
        continue;
      }
      // 設定してない
      if (fileConfig.tapes === 0) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Warning,
            {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 1000 },
            },
            "Please configure the number of tapes"
          )
        );
        continue;
      }
      // 条件が変だよ
      if (cond.length !== fileConfig.tapes) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            condRange,
            `Condition should have ${fileConfig.tapes} element(s)`
          )
        );
      }
      {
        // Conditionの文字数が変だよ
        let idx = 0;
        for (let j = 0; j < cond.length; j++) {
          const range = {
            start: { line: i, character: idx },
            end: { line: i, character: idx + cond[j].length },
          };
          if (cond[j].length === 0) {
            diagnostics.push(
              generateDiagnostic(
                DiagnosticSeverity.Error,
                range,
                "Condition cannot be empty"
              )
            );
          }
          if (cond[j].length > 1) {
            diagnostics.push(
              generateDiagnostic(
                DiagnosticSeverity.Error,
                range,
                "Condition must be 1 character"
              )
            );
            idx += cond[j].length + 1;
          }
        }
      }
      // 個数が変だよ
      if (op.length !== fileConfig.tapes * 2 + 1) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            {
              start: { line: i, character: line.indexOf(" - ") + 3 },
              end: { line: i, character: 1000 },
            },
            `Operation should have ${fileConfig.tapes * 2 + 1} element(s)`
          )
        );
        continue;
      }
      const opOffset = line.indexOf(" - ") + 3;
      const nextState = new Elem(op[0], {
        start: { line: i, character: opOffset },
        end: { line: i, character: opOffset + op[0].length },
      });
      const sums = [op[0].length + 1];
      for (let j = 1; j < op.length; j++) {
        sums.push(sums[j - 1] + op[j].length + 1);
      }
      const write = op.slice(1, fileConfig.tapes + 1).map((s, j) => {
        const range = {
          start: { line: i, character: opOffset + sums[j] },
          end: { line: i, character: opOffset + sums[j] + s.length },
        };
        if (s.length !== 1) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              range,
              `Write must be 1 character`
            )
          );
        } else if (/[LRS]/.test(s)) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Warning,
              range,
              `Write should not be L, R, or S (reserved for moves)`
            )
          );
        }
        return new Elem(s, range);
      });
      const move = op.slice(fileConfig.tapes + 1).map((s, j) => {
        const range = {
          start: { line: i, character: opOffset + sums[j + fileConfig.tapes] },
          end: {
            line: i,
            character: opOffset + sums[j + fileConfig.tapes] + s.length,
          },
        };
        if (!/^L|R|S$/.test(s)) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              range,
              `Move should be L, R, or S`
            )
          );
        }
        return new Elem(s, range);
      });
      state.addOperation(
        new Elem(JSON.stringify(cond), {
          start: {
            line: i,
            character: 0,
          },
          end: {
            line: i,
            character: line.indexOf(" - "),
          },
        }),
        new Operation(nextState, write, move)
      );
    }
  }

  // 各Condが複数定義
  {
    let nowParsingState = "";
    for (let i = 0; i < textDocument.lineCount; i++) {
      const rangeStart = textDocument.positionAt(
        textDocument.offsetAt({ line: i, character: 0 })
      );
      const rangeEnd = textDocument.positionAt(
        textDocument.offsetAt({ line: i, character: 1000 })
      );
      const lineRange: Range = { start: rangeStart, end: rangeEnd };
      const line = textDocument.getText(lineRange).replace(/\r?\n|\r/g, "");

      const stateName = line.includes(" - ") ? null : line;
      if (stateName !== null) {
        nowParsingState = stateName;
        continue;
      }
      const [cond] = line.split(" - ").map((s) => s.split(","));
      const state = fileStates.find((s) => s.getName() === nowParsingState);
      const condRange = {
        start: textDocument.positionAt(
          textDocument.offsetAt({ line: i, character: 0 })
        ),
        end: textDocument.positionAt(
          textDocument.offsetAt({ line: i, character: 1000 })
        ),
      };
      const condStr = JSON.stringify(cond);

      if (state === undefined) {
        continue;
      }

      const op = state.getOperation(new Elem(condStr, null));
      if (op === undefined) {
        continue;
      }
      const tmp = op.getStateName().getRange().start.line;
      if (tmp === i) {
        continue;
      }
      const diagnostic = generateDiagnostic(
        DiagnosticSeverity.Warning,
        condRange,
        `This operation is ignored. The same condition is defined later`
      );
      if (hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: {
                start: {
                  line: tmp,
                  character: 0,
                },
                end: {
                  line: tmp,
                  character: cond.join(",").length,
                },
              },
            },
            message: "The same condition is defined here",
          },
        ];
      }
      diagnostics.push(diagnostic);
    }
  }

  // 存在しないState
  {
    fileStates.forEach((state) => {
      state.getOperations().forEach((op) => {
        const stateName = op.getStateName().getChar();
        if (stateName === "accept" || stateName === "reject") {
          return;
        }
        if (!fileStates.some((s) => s.getName() === stateName)) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              op.getStateName().getRange(),
              `State "${stateName}" is not defined`
            )
          );
        }
      });
    });
  }

  states.set(textDocument.uri, fileStates);
  config.set(textDocument.uri, fileConfig);

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams) => {
  const fileStates = states.get(textDocumentPosition.textDocument.uri);
  if (fileStates === undefined) {
    return;
  }
  const hover: Hover & { contents: string[] } = {
    contents: [""],
  };
  let stateName = "";
  for (let i = 0; i < fileStates.length; i++) {
    const state = fileStates[i];
    if (state.getRange().start.line > textDocumentPosition.position.line) {
      break;
    }
    stateName = state.getName();
  }
  const state = fileStates.find((s) => s.getName() === stateName);
  if (state === undefined) {
    return;
  }
  hover.contents[0] += `**State Name**\n${state.getName()}\n\n`;
  state.getOperations().forEach((op, cond) => {
    if (
      op.getStateName().getRange().start.line !==
      textDocumentPosition.position.line
    ) {
      return;
    }
    hover.contents[0] += `**Condition**\n\n${(JSON.parse(cond) as string[])
      .map((c, i) => ` - Tape ${i + 1}: *${c}*`)
      .join("\n")}\n\n`;
    hover.contents[0] += `**Next State**\n${op.getStateName().getChar()}\n\n`;
    hover.contents[0] += `**Next Tape Letter**\n\n${op
      .getTape()
      .map((c, i) => ` - Tape ${i + 1}: *${c.getChar()}*`)
      .join("\n")}\n\n`;
    hover.contents[0] += `**Tape Head Move**\n\n${op
      .getMove()
      .map((c, i) => ` - Tape ${i + 1}: *${c.getChar()}*`)
      .join("\n")}\n\n`;
  });
  return hover;
});

connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    const fileStates = states.get(textDocumentPosition.textDocument.uri);
    if (fileStates === undefined) {
      return [];
    }
    return [
      ...fileStates.map((state) => {
        return {
          label: state.getName(),
          data: `s-${state.getName()}`,
          kind: CompletionItemKind.Function,
        };
      }),
      {
        label: "accept",
        data: "sc-accept",
        kind: CompletionItemKind.Constant,
      },
      {
        label: "reject",
        data: "sc-reject",
        kind: CompletionItemKind.Constant,
      },
      {
        label: "L",
        data: "m-L",
        kind: CompletionItemKind.Operator,
      },
      {
        label: "R",
        data: "m-R",
        kind: CompletionItemKind.Operator,
      },
      {
        label: "S",
        data: "m-S",
        kind: CompletionItemKind.Operator,
      },
    ];
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data.startsWith("m-")) {
    if (item.data === "m-L") {
      item.detail = "Left";
      item.documentation = "Move the corresponding tape head to the left";
    }
    if (item.data === "m-R") {
      item.detail = "Right";
      item.documentation = "Move the corresponding tape head to the right";
    }
    if (item.data === "m-S") {
      item.detail = "Stay";
      item.documentation = "Do not move the corresponding tape head";
    }
  } else if (item.data.startsWith("sc-")) {
    if (item.data === "sc-accept") {
      item.detail = "Accept";
      item.documentation = "Accept the inputa and Stop the machine";
    }
    if (item.data === "sc-reject") {
      item.detail = "Reject";
      item.documentation = "Reject the inputa and Stop the machine";
    }
  } else if (item.data.startsWith("s-")) {
    item.detail = item.label;
    item.documentation = "Next state name";
  }
  return item;
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  const symbols: SymbolInformation[] = [];
  const textDocument = documents.get(params.textDocument.uri);
  if (textDocument === undefined) {
    return symbols;
  }
  const fileStates = states.get(params.textDocument.uri);
  if (fileStates === undefined) {
    return symbols;
  }
  fileStates.forEach((state) => {
    symbols.push({
      name: state.getName(),
      kind: SymbolKind.Class,
      location: {
        uri: params.textDocument.uri,
        range: state.getRange(),
      },
    });
    state.getOperations().forEach((op) => {
      symbols.push({
        name: op.getStateName().getChar(),
        kind: SymbolKind.Method,
        location: {
          uri: params.textDocument.uri,
          range: op.getStateName().getRange(),
        },
      });
    });
  });
  return symbols;
});

connection.onDefinition((params: TextDocumentPositionParams) => {
  const fileStates = states.get(params.textDocument.uri);
  if (fileStates === undefined) {
    return null;
  }
  let ret = null;
  fileStates.forEach((state) => {
    state.getOperations().forEach((op) => {
      if (inRange(params.position, op.getStateName().getRange())) {
        const stateName = op.getStateName().getChar();
        const found = fileStates.find((s) => s.getName() === stateName);
        if (found) {
          ret = {
            uri: params.textDocument.uri,
            range: found.getRange(),
          };
        }
      }
    });
  });
  return ret;
});

connection.onCodeLens((params: CodeLensParams) => {
  const fileConfig = config.get(params.textDocument.uri);
  if (fileConfig === undefined || fileConfig.found) {
    return [];
  }
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      command: {
        title: "Add Configurations",
        command: "vtm-syntax.addConfiguration",
      },
    },
  ];
});

documents.listen(connection);
connection.listen();
