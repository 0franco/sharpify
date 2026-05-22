import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import sharp from "sharp";
import { buildOutputPath, resolveOutputFormat, toSavedPercent, type BatchOptions } from "./core.js";

interface BatchJobRequest {
  jobId: string;
  files: string[];
  options: BatchOptions;
}

interface ProgressEvent {
  jobId: string;
  filePath: string;
  status: "queued" | "processing" | "done" | "failed" | "cancelled";
  progressIndex: number;
  totalFiles: number;
  result?: {
    inputPath: string;
    outputPath: string;
    originalBytes: number;
    outputBytes: number;
    savedBytes: number;
    savedPercent: number;
    durationMs: number;
    width?: number;
    height?: number;
  };
  error?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function emit(event: ProgressEvent) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function processFile(filePath: string, options: BatchOptions, existingOutputs: Set<string>) {
  const format = resolveOutputFormat(filePath, options.outputFormat);
  const outputPath = buildOutputPath(filePath, options.outputDirectory, options.filenameSuffix, format, existingOutputs);

  await mkdir(dirname(outputPath), { recursive: true });

  const inputStat = await stat(filePath);
  const startedAt = Date.now();
  const source = sharp(filePath, { animated: false, failOn: "warning" });
  const metadata = await source.metadata();
  let pipeline = sharp(filePath, { animated: false, failOn: "warning" });

  if (options.resize?.width || options.resize?.height) {
    pipeline = pipeline.resize({
      width: options.resize.width,
      height: options.resize.height,
      fit: options.resize.fit,
      withoutEnlargement: true
    });
  }

  if (options.metadata === "keep") {
    pipeline = pipeline.withMetadata();
  }

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({
        quality: options.quality ?? 82,
        mozjpeg: true
      });
      break;
    case "png":
      pipeline = pipeline.png({
        compressionLevel: options.pngCompressionLevel ?? 9,
        effort: 8
      });
      break;
    case "webp":
      pipeline = pipeline.webp({
        quality: options.quality ?? 82,
        effort: 5
      });
      break;
    case "avif":
      pipeline = pipeline.avif({
        quality: options.quality ?? 62,
        effort: 5
      });
      break;
  }

  const info = await pipeline.toFile(outputPath);
  const outputStat = await stat(outputPath);

  return {
    inputPath: filePath,
    outputPath,
    originalBytes: inputStat.size,
    outputBytes: outputStat.size,
    savedBytes: Math.max(0, inputStat.size - outputStat.size),
    savedPercent: toSavedPercent(inputStat.size, outputStat.size),
    durationMs: Date.now() - startedAt,
    width: info.width ?? metadata.width,
    height: info.height ?? metadata.height
  };
}

async function main() {
  const raw = await readStdin();
  const request = JSON.parse(raw) as BatchJobRequest;
  const existingOutputs = new Set<string>();

  for (const [index, filePath] of request.files.entries()) {
    emit({
      jobId: request.jobId,
      filePath,
      status: "processing",
      progressIndex: index,
      totalFiles: request.files.length
    });

    try {
      const result = await processFile(filePath, request.options, existingOutputs);
      emit({
        jobId: request.jobId,
        filePath,
        status: "done",
        progressIndex: index,
        totalFiles: request.files.length,
        result
      });
    } catch (error) {
      emit({
        jobId: request.jobId,
        filePath,
        status: "failed",
        progressIndex: index,
        totalFiles: request.files.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

void main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
