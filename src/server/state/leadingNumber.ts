import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateLeadingNumber(
  stateName: string,
  lineRange: Range,
  diagnostics: Diagnostic[]
): void {
  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not start with number.`
  );

  if (/^\d/.test(stateName)) {
    diagnostics.push(diagnostic);
  }
}
