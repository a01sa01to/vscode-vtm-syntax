import { CompletionList, Location, Position, Uri } from "vscode";
import type { DocumentSelector, CompletionItemProvider } from "vscode";

// Todo: Implement
export const provider: CompletionItemProvider = {
  provideCompletionItems(document, position, token) {
    return new CompletionList([], false);
  },
};

export const triggerCharacters = [","];
