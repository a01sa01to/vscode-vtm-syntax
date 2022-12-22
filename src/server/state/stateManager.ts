import { TextDocument } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver/node";
import validateState from "./validate";

export default function stateManager(
  lineRange: Range,
  textDocument: TextDocument,
  states: string[]
) {
  const line = textDocument.getText(lineRange).replace(/\r?\n|\r/g, "");
  if (validateState(line)) {
    states.push(line);
  }
}
