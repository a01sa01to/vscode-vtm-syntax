import { languages } from "vscode";
import type { ExtensionContext } from "vscode";

import * as hoverProvider from "./hoverProvider";

export function activate(context: ExtensionContext) {
  console.log("Virtual Turing Machine Syntax is now active!");
  context.subscriptions.push(
    languages.registerHoverProvider(
      hoverProvider.selector,
      hoverProvider.provider
    )
  );
}

export function deactivate() {}
