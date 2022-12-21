import { languages } from "vscode";
import type { ExtensionContext } from "vscode";

import * as hoverProvider from "./hoverProvider";
import * as definitionProvider from "./definitionProvider";
import * as completionItemProvider from "./completionItemProvider";

export function activate(context: ExtensionContext) {
  console.log("Virtual Turing Machine Syntax is now active!");
  context.subscriptions.push(
    languages.registerHoverProvider(
      hoverProvider.selector,
      hoverProvider.provider
    )
  );
  context.subscriptions.push(
    languages.registerDefinitionProvider(
      definitionProvider.selector,
      definitionProvider.provider
    )
  );
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      completionItemProvider.selector,
      completionItemProvider.provider,
      ...completionItemProvider.triggerCharacters
    )
  );
}

export function deactivate() {}
