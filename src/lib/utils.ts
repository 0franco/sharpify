export function basename(filePath: string): string {
  return filePath.split(/[/\\]/).filter(Boolean).pop() ?? filePath;
}
