import { languages, window, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type {
  ServerOptions,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import { join } from "path";

import * as Provider from "./ProviderCommon";
import hoverProvider from "./hoverProvider";
import definitionProvider from "./definitionProvider";
import * as completionItemProvider from "./completionItemProvider";
import * as highlight from "./highlight";
// import updateDiagnosis from "./diagnosis";

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(join("out", "server", "main.js"));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "virtual-turing-machine" }],
  };

  client = new LanguageClient(
    "vtm-language-server",
    "Virtual Turing Machine Language Server",
    serverOptions,
    clientOptions
  );
  context.subscriptions.push(
    languages.registerDocumentSemanticTokensProvider(
      Provider.selector,
      highlight.provider,
      highlight.legend
    )
  );
  client.start();

  console.log("Virtual Turing Machine Syntax is now active!");
  // context.subscriptions.push(
  //   languages.registerHoverProvider(Provider.selector, hoverProvider)
  // );
  // context.subscriptions.push(
  //   languages.registerDefinitionProvider(Provider.selector, definitionProvider)
  // );
  // context.subscriptions.push(
  //   languages.registerCompletionItemProvider(
  //     Provider.selector,
  //     completionItemProvider.provider,
  //     ...completionItemProvider.triggerCharacters
  //   )
  // );

  // const diagnosicCollection = languages.createDiagnosticCollection(
  //   "virtual-turing-machine-syntax"
  // );
  // if (window.activeTextEditor) {
  //   updateDiagnosis(window.activeTextEditor.document, diagnosicCollection);
  // }
  // context.subscriptions.push(
  //   window.onDidChangeActiveTextEditor((editor) => {
  //     console.log("called!", editor);
  //     if (editor) {
  //       console.log("called2");
  //       updateDiagnosis(editor.document, diagnosicCollection);
  //     }
  //   })
  // );
}
// https://github.com/microsoft/vscode-extension-samples/blob/main/lsp-sample/client/src/extension.ts

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
