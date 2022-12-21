import { Location, Position, Uri } from "vscode";
import type { DefinitionProvider } from "vscode";

// Todo: Implement
const defProvider: DefinitionProvider = {
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

export default defProvider;
