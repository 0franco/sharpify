import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { basename } from "../lib/utils";
import {
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_PNG_COMPRESSION,
  DEFAULT_SUFFIX,
} from "../lib/constants";
import type { AppInfo, BatchOptions, BatchProgressEvent, QueueFile } from "../types";

function createInitialOptions(): BatchOptions {
  return {
    outputFormat: DEFAULT_OUTPUT_FORMAT,
    quality: DEFAULT_QUALITY,
    pngCompressionLevel: DEFAULT_PNG_COMPRESSION,
    metadata: "strip",
    filenameSuffix: DEFAULT_SUFFIX,
    outputDirectory: "",
  };
}

export function useBatchProcessor() {
  const [files, setFiles] = useState<QueueFile[]>([]);
  const [options, setOptions] = useState<BatchOptions>(createInitialOptions);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [summary, setSummary] = useState("Drop images or select files to start a batch.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void invoke<AppInfo>("get_app_info")
      .then(setAppInfo)
      .catch((error) => setErrorMessage(String(error)));
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
          if (file.path !== payload.filePath) return file;

          if (payload.status === "done" && payload.result) {
            return {
              ...file,
              status: "done",
              outputBytes: payload.result.outputBytes,
              savedPercent: payload.result.savedPercent,
              originalBytes: payload.result.originalBytes,
              width: payload.result.width,
              height: payload.result.height,
              error: undefined,
            };
          }

          return { ...file, status: payload.status, error: payload.error };
        }),
      );

      if (payload.status === "processing") {
        setSummary(`Processing ${payload.progressIndex + 1} of ${payload.totalFiles}`);
      }

      if (payload.status === "done" && payload.result) {
        setSummary(`Completed ${payload.progressIndex + 1} of ${payload.totalFiles}`);
      }

      if (
        (payload.status === "done" || payload.status === "failed") &&
        payload.progressIndex === payload.totalFiles - 1
      ) {
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
          status: "queued",
        }));

      if (additions.length === 0) return currentFiles;
      return [...currentFiles, ...additions];
    });
    setSummary(`${incomingPaths.length} file${incomingPaths.length === 1 ? "" : "s"} added to queue.`);
  }

  async function handleSelectFiles() {
    try {
      const selection = await openDialog({
        directory: false,
        multiple: true,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "avif", "tiff", "gif"] }],
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
        defaultPath: options.outputDirectory || undefined,
      });

      if (typeof selection === "string") {
        setOptions((current) => ({ ...current, outputDirectory: selection }));
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
        savedPercent: undefined,
      })),
    );
    setIsProcessing(true);

    try {
      await invoke("run_batch", {
        request: {
          jobId: nextJobId,
          files: files.map((file) => file.path),
          options,
        },
      });
    } catch (error) {
      setErrorMessage(String(error));
      setSummary("Batch did not finish cleanly.");
      setIsProcessing(false);
      setJobId(null);
    }
  }

  async function handleCancel() {
    if (!jobId) return;
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

  return {
    files,
    options,
    setOptions,
    isDragActive,
    isProcessing,
    appInfo,
    summary,
    errorMessage,
    completedCount,
    failedCount,
    totalOriginalBytes,
    totalOutputBytes,
    appendFiles,
    handleSelectFiles,
    handleSelectOutputFolder,
    handleProcess,
    handleCancel,
    removeFile,
    resetQueue,
  };
}
