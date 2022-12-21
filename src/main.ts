import { languages } from "vscode";
import type { ExtensionContext } from "vscode";

import * as Provider from "./ProviderCommon";
import hoverProvider from "./hoverProvider";
import definitionProvider from "./definitionProvider";
import * as completionItemProvider from "./completionItemProvider";

export function activate(context: ExtensionContext) {
  console.log("Virtual Turing Machine Syntax is now active!");
  context.subscriptions.push(
    languages.registerHoverProvider(Provider.selector, hoverProvider)
  );
  context.subscriptions.push(
    languages.registerDefinitionProvider(Provider.selector, definitionProvider)
  );
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      Provider.selector,
      completionItemProvider.provider,
      ...completionItemProvider.triggerCharacters
    )
  );
}

export function deactivate() {}
