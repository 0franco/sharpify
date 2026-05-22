import { basename, extname, join, parse } from "node:path";

export type OutputFormat = "original" | "jpeg" | "png" | "webp" | "avif";

export interface BatchOptions {
  outputFormat: OutputFormat;
  quality?: number;
  pngCompressionLevel?: number;
  resize?: {
    width?: number;
    height?: number;
    fit: "inside" | "cover" | "contain";
  };
  metadata: "keep" | "strip";
  filenameSuffix: string;
  outputDirectory: string;
}

const EXTENSION_TO_FORMAT: Record<string, Exclude<OutputFormat, "original">> = {
  ".avif": "avif",
  ".jpeg": "jpeg",
  ".jpg": "jpeg",
  ".png": "png",
  ".webp": "webp"
};

export function resolveOutputFormat(inputPath: string, requested: OutputFormat): Exclude<OutputFormat, "original"> {
  if (requested !== "original") {
    return requested;
  }

  const extension = extname(inputPath).toLowerCase();
  return EXTENSION_TO_FORMAT[extension] ?? "jpeg";
}

export function normalizeSuffix(suffix: string): string {
  const trimmed = suffix.trim();
  return trimmed.length === 0 ? "-compressed" : trimmed;
}

export function buildOutputPath(inputPath: string, outputDirectory: string, suffix: string, format: Exclude<OutputFormat, "original">, existingPaths: Set<string>): string {
  const parsed = parse(inputPath);
  const baseName = `${parsed.name}${normalizeSuffix(suffix)}`;
  const extension = format === "jpeg" ? ".jpg" : `.${format}`;

  let attempt = join(outputDirectory, `${baseName}${extension}`);
  let iteration = 2;

  while (existingPaths.has(attempt)) {
    attempt = join(outputDirectory, `${baseName}-${iteration}${extension}`);
    iteration += 1;
  }

  existingPaths.add(attempt);
  return attempt;
}

export function toSavedPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) {
    return 0;
  }

  return ((originalBytes - outputBytes) / originalBytes) * 100;
}

export function displayName(inputPath: string): string {
  return basename(inputPath);
}
