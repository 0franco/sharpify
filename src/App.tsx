import { useBatchProcessor } from "./hooks/useBatchProcessor";
import { Hero } from "./components/Hero";
import { Dropzone } from "./components/Dropzone";
import { FileList } from "./components/FileList";
import { ControlsPanel } from "./components/ControlsPanel";

export default function App() {
  const {
    files,
    options,
    setOptions,
    isDragActive,
    isProcessing,
    summary,
    errorMessage,
    completedCount,
    failedCount,
    totalOriginalBytes,
    totalOutputBytes,
    handleSelectFiles,
    handleSelectOutputFolder,
    handleProcess,
    handleCancel,
    removeFile,
    resetQueue,
  } = useBatchProcessor();

  return (
    <main className="app-shell">
      <Hero errorMessage={errorMessage} />

      <Dropzone
        isDragActive={isDragActive}
        isProcessing={isProcessing}
        hasFiles={files.length > 0}
        onSelectFiles={handleSelectFiles}
        onClearQueue={resetQueue}
      />

      <section className="workspace">
        <FileList
          files={files}
          isProcessing={isProcessing}
          completedCount={completedCount}
          failedCount={failedCount}
          summary={summary}
          onRemove={removeFile}
        />

        <ControlsPanel
          options={options}
          setOptions={setOptions}
          isProcessing={isProcessing}
          hasFiles={files.length > 0}
          totalOriginalBytes={totalOriginalBytes}
          totalOutputBytes={totalOutputBytes}
          onSelectOutputFolder={handleSelectOutputFolder}
          onProcess={handleProcess}
          onCancel={handleCancel}
        />
      </section>
    </main>
  );
}
