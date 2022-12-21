import type { DocumentSelector, HoverProvider } from "vscode";

// Todo: Implement
const hoverProvider: HoverProvider = {
  provideHover(document, position, token) {
    const range = document.getWordRangeAtPosition(position);
    if (range === undefined) {
      return undefined;
    }
    const word = document.getText(range);
    return {
      contents: [
        `**${word}**`,
        "This is a hover message from the Virtual Turing Machine Syntax extension.",
      ],
    };
  },
};

export default hoverProvider;
