export default function validateState(line: string): boolean {
  return !line.includes(" - ");
}
