import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import getStateName from "./getName";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateSpecialChar(
  lineRange: Range,
  i: number,
  textDocument: TextDocument,
  diagnostics: Diagnostic[]
): void {
  const state = getStateName(textDocument.getText(lineRange));
  if (!state) {
    return;
  }

  if (state.length === 1) {
    const diagnostic = generateDiagnostic(
      DiagnosticSeverity.Warning,
      lineRange,
      `State name should be at least 2 characters.`
    );
    diagnostics.push(diagnostic);
  }
}
