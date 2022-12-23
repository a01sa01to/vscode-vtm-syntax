import { TextDocument } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver/node";
import getStateName from "./getName";
import { State } from "../classes";

export default function stateManager(
  lineRange: Range,
  textDocument: TextDocument,
  states: State[]
) {
  const state = getStateName(textDocument.getText(lineRange));
  if (state) {
    states.push(new State(state));
  }
}
