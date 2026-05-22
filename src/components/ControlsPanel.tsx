import { openPath } from "@tauri-apps/plugin-opener";
import { formatBytes } from "../lib/format";
import { DEFAULT_FIT, DEFAULT_QUALITY, DEFAULT_PNG_COMPRESSION } from "../lib/constants";
import type { BatchOptions, OutputFormat, ResizeFit } from "../types";

interface ControlsPanelProps {
  options: BatchOptions;
  setOptions: React.Dispatch<React.SetStateAction<BatchOptions>>;
  isProcessing: boolean;
  hasFiles: boolean;
  totalOriginalBytes: number;
  totalOutputBytes: number;
  onSelectOutputFolder: () => void;
  onProcess: () => void;
  onCancel: () => void;
}

export function ControlsPanel({
  options,
  setOptions,
  isProcessing,
  hasFiles,
  totalOriginalBytes,
  totalOutputBytes,
  onSelectOutputFolder,
  onProcess,
  onCancel,
}: ControlsPanelProps) {
  return (
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
              outputFormat: event.target.value as OutputFormat,
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
                pngCompressionLevel: Number(event.target.value),
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
                quality: Number(event.target.value),
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
                  fit: current.resize?.fit ?? DEFAULT_FIT,
                },
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
                  fit: current.resize?.fit ?? DEFAULT_FIT,
                },
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
                fit: event.target.value as ResizeFit,
              },
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
              metadata: event.target.value as BatchOptions["metadata"],
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
              filenameSuffix: event.target.value,
            }))
          }
          disabled={isProcessing}
        />
      </label>

      <label>
        <span>Output folder</span>
        <div className="inline-action">
          <input type="text" value={options.outputDirectory} readOnly placeholder="Select a folder" />
          <button
            type="button"
            className="secondary"
            onClick={() => void onSelectOutputFolder()}
            disabled={isProcessing}
          >
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
        <div className="control-actions-row">
          <button type="button" onClick={() => void onProcess()} disabled={isProcessing || !hasFiles}>
            Start Batch
          </button>
          <button type="button" className="secondary" onClick={() => void onCancel()} disabled={!isProcessing}>
            Cancel
          </button>
        </div>
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
  );
}
