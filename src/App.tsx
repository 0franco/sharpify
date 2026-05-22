import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatBytes, formatPercent } from "./lib/format";
import type { AppInfo, BatchOptions, BatchProgressEvent, OutputFormat, QueueFile, ResizeFit } from "./types";

const DEFAULT_OUTPUT_FORMAT: OutputFormat = "original";
const DEFAULT_FIT: ResizeFit = "inside";
const DEFAULT_QUALITY = 82;
const DEFAULT_PNG_COMPRESSION = 9;
const DEFAULT_SUFFIX = "-compressed";

function basename(filePath: string): string {
  return filePath.split(/[/\\]/).filter(Boolean).pop() ?? filePath;
}

function createInitialOptions(): BatchOptions {
  return {
    outputFormat: DEFAULT_OUTPUT_FORMAT,
    quality: DEFAULT_QUALITY,
    pngCompressionLevel: DEFAULT_PNG_COMPRESSION,
    metadata: "strip",
    filenameSuffix: DEFAULT_SUFFIX,
    outputDirectory: ""
  };
}

export default function App() {
  const [files, setFiles] = useState<QueueFile[]>([]);
  const [options, setOptions] = useState<BatchOptions>(createInitialOptions);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [summary, setSummary] = useState("Drop images or select files to start a batch.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void invoke<AppInfo>("get_app_info").then(setAppInfo).catch((error) => {
      setErrorMessage(String(error));
    });
  }, []);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | undefined;

    unlistenPromise = listen<BatchProgressEvent>("batch-progress", (event) => {
      const payload = event.payload;

      if (!payload.filePath) {
        setErrorMessage(payload.error ?? "Batch failed.");
        setSummary(payload.error ?? "Batch failed.");
        setIsProcessing(false);
        setJobId(null);
        return;
      }

      setFiles((currentFiles) =>
        currentFiles.map((file) => {
          if (file.path !== payload.filePath) {
            return file;
          }

          if (payload.status === "done" && payload.result) {
            return {
              ...file,
              status: "done",
              outputBytes: payload.result.outputBytes,
              savedPercent: payload.result.savedPercent,
              originalBytes: payload.result.originalBytes,
              width: payload.result.width,
              height: payload.result.height,
              error: undefined
            };
          }

          return {
            ...file,
            status: payload.status,
            error: payload.error
          };
        }),
      );

      if (payload.status === "processing") {
        setSummary(`Processing ${payload.progressIndex + 1} of ${payload.totalFiles}`);
      }

      if (payload.status === "done" && payload.result) {
        setSummary(`Completed ${payload.progressIndex + 1} of ${payload.totalFiles}`);
      }

      if ((payload.status === "done" || payload.status === "failed") && payload.progressIndex === payload.totalFiles - 1) {
        setIsProcessing(false);
        setJobId(null);
        setSummary("Batch finished. Review the queue for per-file results.");
      }
    });

    const currentWindow = getCurrentWindow();
    let stopDragDrop: (() => void) | undefined;

    void currentWindow.onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragActive(true);
        return;
      }

      if (event.payload.type === "drop") {
        setIsDragActive(false);
        appendFiles(event.payload.paths);
        return;
      }

      setIsDragActive(false);
    }).then((unlistenDragDrop) => {
      stopDragDrop = unlistenDragDrop;
    });

    return () => {
      void unlistenPromise?.then((unlisten) => unlisten());
      stopDragDrop?.();
    };
  }, []);

  const completedCount = useMemo(
    () => files.filter((file) => file.status === "done").length,
    [files],
  );
  const failedCount = useMemo(
    () => files.filter((file) => file.status === "failed").length,
    [files],
  );

  function appendFiles(incomingPaths: string[]) {
    setErrorMessage(null);
    setFiles((currentFiles) => {
      const existing = new Set(currentFiles.map((file) => file.path));
      const additions = incomingPaths
        .filter((filePath) => !existing.has(filePath))
        .map<QueueFile>((filePath) => ({
          path: filePath,
          name: basename(filePath),
          status: "queued"
        }));

      if (additions.length === 0) {
        return currentFiles;
      }

      return [...currentFiles, ...additions];
    });
    setSummary(`${incomingPaths.length} file${incomingPaths.length === 1 ? "" : "s"} added to queue.`);
  }

  async function handleSelectFiles() {
    try {
      const selection = await openDialog({
        directory: false,
        multiple: true,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp", "avif", "tiff", "gif"]
          }
        ]
      });

      if (!selection) {
        setSummary("File selection cancelled.");
        return;
      }

      appendFiles(Array.isArray(selection) ? selection : [selection]);
    } catch (error) {
      const message = `Unable to open the file picker: ${String(error)}`;
      setErrorMessage(message);
      setSummary(message);
    }
  }

  async function handleSelectOutputFolder() {
    try {
      const selection = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: options.outputDirectory || undefined
      });

      if (typeof selection === "string") {
        setOptions((current) => ({
          ...current,
          outputDirectory: selection
        }));
        setSummary("Output folder selected.");
      }
    } catch (error) {
      const message = `Unable to open the folder picker: ${String(error)}`;
      setErrorMessage(message);
      setSummary(message);
    }
  }

  async function handleProcess() {
    if (files.length === 0) {
      setErrorMessage("Add at least one image to process.");
      return;
    }

    if (!options.outputDirectory) {
      setErrorMessage("Choose an output folder before processing.");
      return;
    }

    const nextJobId = crypto.randomUUID();
    setJobId(nextJobId);
    setErrorMessage(null);
    setSummary(`Starting batch of ${files.length} files.`);
    setFiles((currentFiles) =>
      currentFiles.map((file) => ({
        ...file,
        status: "queued",
        error: undefined,
        outputBytes: undefined,
        savedPercent: undefined
      })),
    );
    setIsProcessing(true);

    try {
      await invoke("run_batch", {
        request: {
          jobId: nextJobId,
          files: files.map((file) => file.path),
          options
        }
      });
    } catch (error) {
      setErrorMessage(String(error));
      setSummary("Batch did not finish cleanly.");
      setIsProcessing(false);
      setJobId(null);
    }
  }

  async function handleCancel() {
    if (!jobId) {
      return;
    }

    await invoke("cancel_batch", { jobId });
    setSummary("Cancellation requested.");
    setIsProcessing(false);
  }

  function removeFile(path: string) {
    setFiles((currentFiles) => currentFiles.filter((file) => file.path !== path));
  }

  function resetQueue() {
    setFiles([]);
    setSummary("Queue cleared.");
    setErrorMessage(null);
  }

  const totalOriginalBytes = files.reduce((sum, file) => sum + (file.originalBytes ?? 0), 0);
  const totalOutputBytes = files.reduce((sum, file) => sum + (file.outputBytes ?? 0), 0);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Sharpify</p>
          <h1>Batch image compression without leaving the desktop.</h1>
          <p className="lede">
            Drop files, set a few real options, and export optimized images to a folder you control.
          </p>
        </div>
        <div className="hero-card">
          <span>{appInfo ? `${appInfo.platform} • ${appInfo.processorMode}` : "Loading runtime"}</span>
          <strong>{summary}</strong>
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </div>
      </section>

      <section className={`dropzone ${isDragActive ? "drag-active" : ""}`}>
        <div>
          <h2>Queue</h2>
          <p>Drop image files anywhere in the window or select them manually.</p>
        </div>
        <div className="dropzone-actions">
          <button type="button" onClick={() => void handleSelectFiles()}>
            Select Images
          </button>
          <button type="button" className="secondary" onClick={resetQueue} disabled={files.length === 0 || isProcessing}>
            Clear Queue
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="panel queue-panel">
          <div className="panel-header">
            <h3>{files.length} file{files.length === 1 ? "" : "s"}</h3>
            <span>{completedCount} done / {failedCount} failed</span>
          </div>
          <div className="file-list">
            {files.length === 0 ? (
              <div className="empty-state">
                Add JPEG, PNG, WebP, AVIF, TIFF, or GIF files to begin.
              </div>
            ) : (
              files.map((file) => (
                <article key={file.path} className="file-row">
                  <div className="file-meta">
                    <strong>{file.name}</strong>
                    <span>{file.width && file.height ? `${file.width}×${file.height}` : "Pending scan"} • {formatBytes(file.originalBytes)}</span>
                  </div>
                  <div className="file-result">
                    <span className={`status status-${file.status}`}>{file.status}</span>
                    <span>{formatBytes(file.outputBytes)} • {formatPercent(file.savedPercent)}</span>
                  </div>
                  <div className="file-actions">
                    {file.error ? <span className="error">{file.error}</span> : null}
                    <button type="button" className="secondary" onClick={() => removeFile(file.path)} disabled={isProcessing}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="panel controls-panel">
          <div className="panel-header">
            <h3>Options</h3>
            <span>Batch-wide settings</span>
          </div>

          <label>
            <span>Output format</span>
            <select
              value={options.outputFormat}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  outputFormat: event.target.value as OutputFormat
                }))
              }
              disabled={isProcessing}
            >
              <option value="original">Keep original</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
            </select>
          </label>

          {options.outputFormat === "png" ? (
            <label>
              <span>PNG compression level</span>
              <input
                type="range"
                min="0"
                max="9"
                value={options.pngCompressionLevel ?? DEFAULT_PNG_COMPRESSION}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    pngCompressionLevel: Number(event.target.value)
                  }))
                }
                disabled={isProcessing}
              />
              <small>{options.pngCompressionLevel ?? DEFAULT_PNG_COMPRESSION}</small>
            </label>
          ) : (
            <label>
              <span>Quality</span>
              <input
                type="range"
                min="30"
                max="95"
                value={options.quality ?? DEFAULT_QUALITY}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    quality: Number(event.target.value)
                  }))
                }
                disabled={isProcessing}
              />
              <small>{options.quality ?? DEFAULT_QUALITY}</small>
            </label>
          )}

          <div className="grid">
            <label>
              <span>Max width</span>
              <input
                type="number"
                min="1"
                placeholder="Optional"
                value={options.resize?.width ?? ""}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    resize: {
                      width: event.target.value ? Number(event.target.value) : undefined,
                      height: current.resize?.height,
                      fit: current.resize?.fit ?? DEFAULT_FIT
                    }
                  }))
                }
                disabled={isProcessing}
              />
            </label>
            <label>
              <span>Max height</span>
              <input
                type="number"
                min="1"
                placeholder="Optional"
                value={options.resize?.height ?? ""}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    resize: {
                      width: current.resize?.width,
                      height: event.target.value ? Number(event.target.value) : undefined,
                      fit: current.resize?.fit ?? DEFAULT_FIT
                    }
                  }))
                }
                disabled={isProcessing}
              />
            </label>
          </div>

          <label>
            <span>Fit</span>
            <select
              value={options.resize?.fit ?? DEFAULT_FIT}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  resize: {
                    width: current.resize?.width,
                    height: current.resize?.height,
                    fit: event.target.value as ResizeFit
                  }
                }))
              }
              disabled={isProcessing}
            >
              <option value="inside">Inside</option>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>

          <label>
            <span>Metadata</span>
            <select
              value={options.metadata}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  metadata: event.target.value as BatchOptions["metadata"]
                }))
              }
              disabled={isProcessing}
            >
              <option value="strip">Strip metadata</option>
              <option value="keep">Keep metadata</option>
            </select>
          </label>

          <label>
            <span>Filename suffix</span>
            <input
              type="text"
              value={options.filenameSuffix}
              onChange={(event) =>
                setOptions((current) => ({
                  ...current,
                  filenameSuffix: event.target.value
                }))
              }
              disabled={isProcessing}
            />
          </label>

          <label>
            <span>Output folder</span>
            <div className="inline-action">
              <input type="text" value={options.outputDirectory} readOnly placeholder="Select a folder" />
              <button type="button" className="secondary" onClick={() => void handleSelectOutputFolder()} disabled={isProcessing}>
                Choose
              </button>
            </div>
          </label>

          <div className="stats-card">
            <span>Input total</span>
            <strong>{formatBytes(totalOriginalBytes)}</strong>
            <span>Output total</span>
            <strong>{formatBytes(totalOutputBytes)}</strong>
          </div>

          <div className="control-actions">
            <button type="button" onClick={() => void handleProcess()} disabled={isProcessing || files.length === 0}>
              Start Batch
            </button>
            <button type="button" className="secondary" onClick={() => void handleCancel()} disabled={!isProcessing}>
              Cancel
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void openPath(options.outputDirectory)}
              disabled={!options.outputDirectory}
            >
              Open Output Folder
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
