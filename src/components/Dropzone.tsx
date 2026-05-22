interface DropzoneProps {
  isDragActive: boolean;
  isProcessing: boolean;
  hasFiles: boolean;
  onSelectFiles: () => void;
  onClearQueue: () => void;
}

export function Dropzone({ isDragActive, isProcessing, hasFiles, onSelectFiles, onClearQueue }: DropzoneProps) {
  return (
    <section className={`dropzone ${isDragActive ? "drag-active" : ""}`}>
      <div>
        <h2>Queue</h2>
        <p>Drop image files anywhere in the window or select them manually.</p>
      </div>
      <div className="dropzone-actions">
        <button type="button" onClick={() => void onSelectFiles()}>
          Select Images
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onClearQueue}
          disabled={!hasFiles || isProcessing}
        >
          Clear Queue
        </button>
      </div>
    </section>
  );
}
