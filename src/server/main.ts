import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItemKind,
  DidChangeConfigurationNotification,
  DiagnosticSeverity,
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
import { State } from "./classes";
import generateDiagnostic from "./utils/generateDiagnostic";

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
    // Many Problems
    if (diagnostics.length >= settings.maxNumberOfProblems) {
      break;
    }

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

    // State
    const stateName = line.includes(" - ") ? null : line;
    if (stateName !== null) {
      nowParsingState = stateName;
      stateSpecialChar(
        stateName,
        lineRange,
        textDocument,
        hasDiagnosticRelatedInformationCapability,
        diagnostics
      );
      if (stateName.length === 1) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Warning,
            lineRange,
            "State name should be at least 2 characters long"
          )
        );
      }
      if (/^\d/.test(stateName)) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Warning,
            lineRange,
            "State name should not start with a number"
          )
        );
      }
      if (/^(accept|reject)$/.test(stateName)) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            lineRange,
            "This state name is reserved"
          )
        );
      }
      fileStates.push(new State(stateName));
    }
    // Operation
    else {
      const [cond, op] = line.split(" - ").map((s) => s.split(","));
      const state = fileStates.find((s) => s.getName() === nowParsingState);
      if (state === undefined) {
        diagnostics.push(
          generateDiagnostic(
            DiagnosticSeverity.Error,
            lineRange,
            "You need to define a state first"
          )
        );
      }
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
      } else {
        if (cond.length !== fileConfig.tapes) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              lineRange,
              `Condition should have ${fileConfig.tapes} element(s)`
            )
          );
        }
        if (op.length !== fileConfig.tapes * 2 + 1) {
          diagnostics.push(
            generateDiagnostic(
              DiagnosticSeverity.Error,
              lineRange,
              `Operation should have ${fileConfig.tapes * 2 + 1} element(s)`
            )
          );
        }
      }
    }
  }
  states.set(textDocument.uri, fileStates);
  config.set(textDocument.uri, fileConfig);
  console.log(config, states);

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onHover((_textDocumentPosition: TextDocumentPositionParams) => {
  console.log("onHover", _textDocumentPosition);
  const hover: Hover = {
    contents: [
      {
        language: "markdown",
        value: `This is a hover\n\n${documents
          .get(_textDocumentPosition.textDocument.uri)
          ?.getText()}`,
      },
    ],
  };
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

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
