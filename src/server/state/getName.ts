export default function getStateName(line: string): string | null {
  if (line.trim().length !== 0 || line.includes(" - ")) {
    return null;
  }
  return line.replace(/\r?\n|\r/g, "");
}
