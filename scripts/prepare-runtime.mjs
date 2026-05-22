import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const runtimeDir = join(projectRoot, "src-tauri", "resources", "runtime");
const nodeTargetDir = join(runtimeDir, "node");

rmSync(runtimeDir, { force: true, recursive: true });
mkdirSync(nodeTargetDir, { recursive: true });

const nodeBinaryName = process.platform === "win32" ? "node.exe" : "node";
const nodeTargetPath = join(nodeTargetDir, nodeBinaryName);

cpSync(process.execPath, nodeTargetPath);

const processorFiles = [
  join(projectRoot, "processor", "dist"),
  join(projectRoot, "processor", "package.json"),
  join(projectRoot, "node_modules")
];

const processorTargetDir = join(runtimeDir, "processor");
mkdirSync(processorTargetDir, { recursive: true });

for (const sourcePath of processorFiles) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing processor runtime dependency: ${sourcePath}`);
  }

  cpSync(sourcePath, join(processorTargetDir, basename(sourcePath)), {
    recursive: statSync(sourcePath).isDirectory()
  });
}
