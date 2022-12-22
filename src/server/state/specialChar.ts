import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import validateState from "./validate";
import generateDiagnostic from "../utils/generateDiagnostic";

type TSpecialChar = " " | "-" | ",";
const specialChars = [" ", "-", ","] as TSpecialChar[];
// eslint-disable-next-line @typescript-eslint/naming-convention
const char2str = { " ": "space", "-": "hyphen", ",": "comma" };

export default function stateSpecialChar(
  lineRange: Range,
  i: number,
  textDocument: TextDocument,
  hasDiagnosticRelatedInformationCapability: boolean,
  diagnostics: Diagnostic[]
): void {
  // Get Line Text
  const line = textDocument.getText(lineRange);

  // Check if line defines a state
  if (!validateState(line)) {
    return;
  }

  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not contain spaces, hyphens and commas.`
  );
  diagnostic.relatedInformation = [];

  // Read line char by char
  for (let j = 0; j < line.length; j++) {
    const infoRange: Range = {
      start: { line: i, character: j },
      end: { line: i, character: j + 1 },
    };
    // Check if char is a special char
    for (const sc of specialChars) {
      if (line[j] === sc) {
        diagnostic.relatedInformation?.push({
          location: {
            uri: textDocument.uri,
            range: infoRange,
          },
          message: `State name should not contain ${
            char2str[line[j] as TSpecialChar]
          }.`,
        });
      }
    }
  }

  // If there are special chars
  if (diagnostic.relatedInformation.length !== 0) {
    if (!hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = undefined;
    }
    diagnostics.push(diagnostic);
  }
}
