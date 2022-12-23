import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateSpecialChar(
  stateName: string,
  lineRange: Range,
  diagnostics: Diagnostic[]
): void {
  if (stateName.length === 1) {
    const diagnostic = generateDiagnostic(
      DiagnosticSeverity.Warning,
      lineRange,
      `State name should be at least 2 characters.`
    );
    diagnostics.push(diagnostic);
  }
}
