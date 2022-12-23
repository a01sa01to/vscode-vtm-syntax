import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import generateDiagnostic from "../utils/generateDiagnostic";

type TSpecialChar = " " | "-" | "," | "#";
const specialChars = [" ", "-", ",", "#"] as TSpecialChar[];
// eslint-disable-next-line @typescript-eslint/naming-convention
const char2str = { " ": "space", "-": "hyphen", ",": "comma", "#": "hash" };

export default function stateSpecialChar(
  stateName: string,
  lineRange: Range,
  textDocument: TextDocument,
  hasDiagnosticRelatedInformationCapability: boolean,
  diagnostics: Diagnostic[]
): void {
  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not contain special characters`
  );
  diagnostic.relatedInformation = [];

  // Read line char by char
  for (let j = 0; j < stateName.length; j++) {
    const infoRange: Range = {
      start: { line: lineRange.start.line, character: j },
      end: { line: lineRange.start.line, character: j + 1 },
    };
    // Check if char is a special char
    for (const sc of specialChars) {
      if (stateName[j] === sc) {
        diagnostic.relatedInformation?.push({
          location: {
            uri: textDocument.uri,
            range: infoRange,
          },
          message: `State name should not contain ${
            char2str[stateName[j] as TSpecialChar]
          }`,
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
