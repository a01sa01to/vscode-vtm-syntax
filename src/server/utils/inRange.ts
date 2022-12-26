import type { Range, Position } from "vscode-languageserver/node";

export function inRange(position: Position, range: Range) {
  return (
    position.line >= range.start.line &&
    position.line <= range.end.line &&
    position.character >= range.start.character &&
    position.character <= range.end.character
  );
}
