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
  DocumentSymbolParams,
  MarkedString,
} from "vscode-languageserver/node";
import type {
  Range,
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
const config = new Map<string, { tapes: number; initialState: string }>();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// --------------- Server Functions ----------------- //
connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = Boolean(
    capabilities.workspace && capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = Boolean(
    capabilities.workspace && capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = Boolean(
    capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      hoverProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface ExtensionSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExtensionSettings = { maxNumberOfProblems: 100 };

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExtensionSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExtensionSettings> {
  let result = documentSettings.get(resource);
  if (!result) {
    result = new Promise((r) => r(defaultSettings));
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  let fileStates: State[] = [];
  let fileConfig = { tapes: 0, initialState: "" };

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
        fileConfig.tapes = parseInt(line.split(":")[1].trim());
      }
      if (line.toLowerCase().includes("initial")) {
        fileConfig.initialState = line.split(":")[1].trim();
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
      console.log(op);
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
      console.log("fiiii", write, move);
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
      console.log(state);
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
      console.log(state.getName(), state.getOperations());
      state.getOperations().forEach((op) => {
        const stateName = op.getStateName().getChar();
        console.log(stateName);
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
  console.log(config, states);

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams) => {
  console.log("onHover", textDocumentPosition);
  const fileStates = states.get(textDocumentPosition.textDocument.uri);
  if (fileStates === undefined) {
    return;
  }
  const hover: Hover & { contents: MarkedString[] } = {
    contents: [],
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
  hover.contents.push(`State: ${state.getName()}`);
  state.getOperations().forEach((op, cond) => {
    if (
      op.getStateName().getRange().start.line !==
      textDocumentPosition.position.line
    ) {
      return;
    }
    hover.contents.push(`Condition: ${JSON.parse(cond).join(",")}`);
    hover.contents.push(`Next State: ${op.getStateName().getChar()}`);
    hover.contents.push(
      `Write: ${op
        .getTape()
        .map((el) => el.getChar())
        .join(",")}`
    );
    hover.contents.push(
      `Move: ${op
        .getMove()
        .map((el) => el.getChar())
        .join(",")}`
    );
  });
  return hover;
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    console.log("onCompletion", _textDocumentPosition);
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: "TypeScript",
        kind: CompletionItemKind.Text,
        data: 1,
      },
      {
        label: "JavaScript",
        kind: CompletionItemKind.Text,
        data: 2,
      },
    ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  console.log("onCompletionResolve", item);
  if (item.data === 1) {
    item.detail = "TypeScript details";
    item.documentation = "TypeScript documentation";
  } else if (item.data === 2) {
    item.detail = "JavaScript details";
    item.documentation = "JavaScript documentation";
  }
  return item;
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  console.log("onDocumentSymbol", params);
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
  console.log("onDefinition", params);
  const fileStates = states.get(params.textDocument.uri);
  console.log("filestates", fileStates);
  if (fileStates === undefined) {
    return null;
  }
  let ret = null;
  fileStates.forEach((state) => {
    state.getOperations().forEach((op) => {
      console.log(
        op.getStateName().getRange(),
        params.position,
        inRange(params.position, op.getStateName().getRange())
      );
      if (inRange(params.position, op.getStateName().getRange())) {
        const stateName = op.getStateName().getChar();
        console.log(stateName, "filestates:", fileStates);
        const found = fileStates.find((s) => s.getName() === stateName);
        console.log("found:", found);
        if (found) {
          ret = {
            uri: params.textDocument.uri,
            range: found.getRange(),
          };
        }
      }
    });
  });
  console.log(ret);
  return ret;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
