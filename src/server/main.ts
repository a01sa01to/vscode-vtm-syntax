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
  Diagnostic,
  InitializeParams,
  CompletionItem,
  TextDocumentPositionParams,
  InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import * as constant from "../const";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  console.log("onInitialize");
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

  console.log("hasConfigurationCapability", hasConfigurationCapability);
  console.log("hasWorkspaceFolderCapability", hasWorkspaceFolderCapability);
  console.log(
    "hasDiagnosticRelatedInformationCapability",
    hasDiagnosticRelatedInformationCapability
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
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

  console.log("result", result);
  return result;
});

connection.onInitialized(() => {
  console.log("onInitialized 78");
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
const defaultSettings: ExtensionSettings = { maxNumberOfProblems: 1000 };

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExtensionSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  console.log("onDidChangeConfiguration");
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

  const text = textDocument.getText();
  const lines = text.split(/\r?\n/g);

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  for (let i = 0; i < textDocument.lineCount; i++) {
    // Many Problems
    if (problems >= settings.maxNumberOfProblems) {
      break;
    }

    const rangeStart = textDocument.positionAt(
      textDocument.offsetAt({ line: i, character: 0 })
    );
    const rangeEnd = textDocument.positionAt(
      textDocument.offsetAt({ line: i, character: 1000 })
    );
    const lineRange: Range = { start: rangeStart, end: rangeEnd };
    const line = textDocument.getText(lineRange);

    // Skip comments
    if (line.startsWith("#")) {
      continue;
    }
    // Skip empty lines
    if (line.trim().length === 0) {
      continue;
    }

    // State
    if (!line.includes(" - ")) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: lineRange,
        message: `State name should not contain spaces, hyphens and commas.`,
        source: "VTM Syntax",
      };
      diagnostic.relatedInformation = [];
      for (let j = 0; j < line.length; j++) {
        const infoRange: Range = {
          start: { line: i, character: j },
          end: { line: i, character: j + 1 },
        };
        for (const sc of constant.specialChars) {
          if (line[j] === sc) {
            diagnostic.relatedInformation.push({
              location: {
                uri: textDocument.uri,
                range: infoRange,
              },
              message: `State name should not contain ${
                constant.char2str[line[j] as constant.SpecialChar]
              }.`,
            });
          }
        }
      }
      if (diagnostic.relatedInformation.length !== 0) {
        if (!hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = undefined;
        }
        diagnostics.push(diagnostic);
      }
    }
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
  console.log("onDidChangeWatchedFiles", _change);
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
