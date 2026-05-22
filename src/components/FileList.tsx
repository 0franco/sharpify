import { formatBytes, formatPercent } from "../lib/format";
import type { QueueFile } from "../types";

interface FileListProps {
  files: QueueFile[];
  isProcessing: boolean;
  completedCount: number;
  failedCount: number;
  summary: string;
  onRemove: (path: string) => void;
}

export function FileList({ files, isProcessing, completedCount, failedCount, summary, onRemove }: FileListProps) {
  return (
    <div className="panel queue-panel">
      <div className="panel-header">
        <h3>
          {files.length} file{files.length === 1 ? "" : "s"}
        </h3>
        <span>
          {completedCount} done / {failedCount} failed
        </span>
      </div>
      <div className="file-list">
        {files.length === 0 ? (
          <div className="empty-state">Add JPEG, PNG, WebP, AVIF, TIFF, or GIF files to begin.</div>
        ) : (
          files.map((file) => (
            <article key={file.path} className="file-row">
              <div className="file-meta">
                <strong>{file.name}</strong>
                <span>
                  {file.width && file.height ? `${file.width}×${file.height}` : "Pending scan"} •{" "}
                  {formatBytes(file.originalBytes)}
                </span>
              </div>
              <div className="file-result">
                <span className={`status status-${file.status}`}>{file.status}</span>
                <span>
                  {formatBytes(file.outputBytes)} • {formatPercent(file.savedPercent)}
                </span>
              </div>
              <div className="file-actions">
                {file.error ? <span className="error">{file.error}</span> : null}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onRemove(file.path)}
                  disabled={isProcessing}
                >
                  Remove
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {summary ? <p className="queue-summary">{summary}</p> : null}
    </div>
  );
}
