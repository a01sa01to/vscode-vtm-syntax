import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateNumberOnly(
  stateName: string,
  lineRange: Range,
  diagnostics: Diagnostic[]
): void {
  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not be only numbers.`
  );

  if (/^\d+$/.test(stateName)) {
    diagnostics.push(diagnostic);
  }
}
