export type OutputFormat = "original" | "jpeg" | "png" | "webp" | "avif";
export type ResizeFit = "inside" | "cover" | "contain";
export type FileStatus = "queued" | "processing" | "done" | "failed" | "cancelled";

export interface BatchOptions {
  outputFormat: OutputFormat;
  quality?: number;
  pngCompressionLevel?: number;
  resize?: {
    width?: number;
    height?: number;
    fit: ResizeFit;
  };
  metadata: "keep" | "strip";
  filenameSuffix: string;
  outputDirectory: string;
}

export interface QueueFile {
  path: string;
  name: string;
  status: FileStatus;
  originalBytes?: number;
  width?: number;
  height?: number;
  outputBytes?: number;
  savedPercent?: number;
  error?: string;
}

export interface ProcessedFileResult {
  inputPath: string;
  outputPath: string;
  originalBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedPercent: number;
  durationMs: number;
  width?: number;
  height?: number;
}

export interface BatchProgressEvent {
  jobId: string;
  filePath: string;
  status: FileStatus;
  progressIndex: number;
  totalFiles: number;
  result?: ProcessedFileResult;
  error?: string;
}

export interface AppInfo {
  platform: string;
  version: string;
  processorMode: "bundled" | "system-node";
  defaultOutputDirectory: string;
}
