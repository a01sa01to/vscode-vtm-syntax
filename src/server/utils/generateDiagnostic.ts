import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";

export default function generateDiagnostic(
  level: DiagnosticSeverity,
  range: Range,
  message: string
): Diagnostic {
  return {
    severity: level,
    range,
    message,
    source: "VTM Syntax",
  };
}
