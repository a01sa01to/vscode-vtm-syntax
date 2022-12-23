import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { Range, Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import getStateName from "./getName";
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
  // Check if line defines a state
  const state = getStateName(textDocument.getText(lineRange));
  if (!state) {
    return;
  }

  const diagnostic = generateDiagnostic(
    DiagnosticSeverity.Warning,
    lineRange,
    `State name should not contain spaces, hyphens and commas.`
  );
  diagnostic.relatedInformation = [];

  // Read line char by char
  for (let j = 0; j < state.length; j++) {
    const infoRange: Range = {
      start: { line: i, character: j },
      end: { line: i, character: j + 1 },
    };
    // Check if char is a special char
    for (const sc of specialChars) {
      if (state[j] === sc) {
        diagnostic.relatedInformation?.push({
          location: {
            uri: textDocument.uri,
            range: infoRange,
          },
          message: `State name should not contain ${
            char2str[state[j] as TSpecialChar]
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
