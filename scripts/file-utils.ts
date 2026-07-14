import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function listFiles(root: string, predicate: (filePath: string) => boolean): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath, predicate));
    if (entry.isFile() && predicate(entryPath)) files.push(entryPath);
  }
  return files.sort();
}

export async function readUtf8(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
