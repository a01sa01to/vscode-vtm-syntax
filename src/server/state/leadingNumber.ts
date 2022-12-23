import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import getStateName from "./getName";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateLeadingNumber(
  lineRange: Range,
  i: number,
  textDocument: TextDocument,
  diagnostics: Diagnostic[]
): void {
  const state = getStateName(textDocument.getText(lineRange));
  if (!state) {
    return;
  }
  console.log("stateLeadingNumber");

  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not start with number.`
  );

  if (/^\d/.test(state)) {
    diagnostics.push(diagnostic);
  }
}
