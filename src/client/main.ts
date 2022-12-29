import { commands, languages, window, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type {
  ServerOptions,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import { join } from "path";

import * as Provider from "./ProviderCommon";
import * as highlight from "./highlight";

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  // Start the language server
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
  client.start();

  // Register the highlight provider
  context.subscriptions.push(
    languages.registerDocumentSemanticTokensProvider(
      Provider.selector,
      highlight.provider,
      highlight.legend
    )
  );

  // Register the Command
  context.subscriptions.push(
    commands.registerCommand("vtm-syntax.addConfiguration", () => {
      const editor = window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        editor.edit((editBuilder) => {
          editBuilder.insert(
            document.positionAt(0),
            "## Initial State: ___\n## Tape(s) used: 1\n\n"
          );
        });
      }
    })
  );

  console.log("Virtual Turing Machine Syntax is now active!");
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
