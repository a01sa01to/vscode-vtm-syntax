import { Location, Position, Uri } from "vscode";
import type { DocumentSelector, DefinitionProvider } from "vscode";

export const selector: DocumentSelector = {
  language: "virtual-turing-machine",
  scheme: "file",
};

// Todo: Implement
export const provider: DefinitionProvider = {
  provideDefinition(document, position, token) {
    const range = document.getWordRangeAtPosition(position);
    if (range === undefined) {
      return undefined;
    }
    const word = document.getText(range);

    const uri = Uri.file(document.fileName);
    const pos = new Position(0, 0);
    return new Location(uri, pos);
  },
};
