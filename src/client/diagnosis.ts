import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import type { DiagnosticCollection, TextDocument } from "vscode";

export default function fileChangeCallback(
  document: TextDocument,
  collection: DiagnosticCollection
) {
  // Todo: Implement
  const diagnoseResult: Diagnostic[] = [];
  console.log("Hi!");
  if (document) {
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      if (text.startsWith("#")) {
        continue;
      }
      if (!text.includes(" - ")) {
        // State
        if (text === "accept") {
          diagnoseResult.push(
            new Diagnostic(
              line.range,
              `State name "accept" is reserved`,
              DiagnosticSeverity.Error
            )
          );
        }
        if (text === "reject") {
          diagnoseResult.push(
            new Diagnostic(
              line.range,
              `State name "reject" is reserved`,
              DiagnosticSeverity.Error
            )
          );
        }

        const shouldNotContain = ["#", " ", ","];
        for (const symbol of shouldNotContain) {
          if (text.includes(symbol)) {
            diagnoseResult.push(
              new Diagnostic(
                line.range,
                `State name should not contain ${
                  symbol === " " ? "space" : `"${symbol}"`
                }`,
                DiagnosticSeverity.Warning
              )
            );
          }
        }
      }
    }
  }
  collection.set(document.uri, diagnoseResult);
}
