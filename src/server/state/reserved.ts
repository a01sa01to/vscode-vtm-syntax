import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import getStateName from "./getName";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateReserved(
  lineRange: Range,
  i: number,
  textDocument: TextDocument,
  diagnostics: Diagnostic[]
): void {
  const state = getStateName(textDocument.getText(lineRange));
  if (!state) {
    return;
  }

  if (state === "accept" || state === "reject") {
    const diagnostic = generateDiagnostic(
      DiagnosticSeverity.Error,
      lineRange,
      `This state name is reserved.`
    );
    diagnostics.push(diagnostic);
  }
}
