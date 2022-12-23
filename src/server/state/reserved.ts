import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import generateDiagnostic from "../utils/generateDiagnostic";

export default function stateReserved(
  stateName: string,
  lineRange: Range,
  diagnostics: Diagnostic[]
): void {
  if (stateName === "accept" || stateName === "reject") {
    const diagnostic = generateDiagnostic(
      DiagnosticSeverity.Error,
      lineRange,
      `This state name is reserved.`
    );
    diagnostics.push(diagnostic);
  }
}
