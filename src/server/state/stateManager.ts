import { TextDocument } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver/node";
import getStateName from "./getName";

export default function stateManager(
  lineRange: Range,
  textDocument: TextDocument,
  states: string[]
) {
  const state = getStateName(textDocument.getText(lineRange));
  if (state) {
    states.push(state);
  }
}
