## Commands

```bash
# Install dependencies
npm install

# Run in development (Tauri + Vite hot-reload)
npm run tauri:dev

# Build for production
npm run tauri:build

# Run tests (processor unit tests + TypeScript type-check)
npm run test

# Run processor tests only
npm run test:processor

# Type-check frontend only
tsc --noEmit

# Build processor (TypeScript → dist/cli.js)
npm run build:processor

# Bundle node binary + processor into src-tauri/resources/runtime
npm run prepare:runtime
```

## Architecture

Sharpify is a Tauri v2 desktop app with three distinct layers that communicate through a well-defined protocol:

### 1. React Frontend (`src/`)
A single-page UI. All state lives in `useBatchProcessor` (`src/hooks/useBatchProcessor.ts`), which wires together file queue management, Tauri drag-drop events, dialog calls, and progress updates. `App.tsx` composes the four presentational components (`Hero`, `Dropzone`, `FileList`, `ControlsPanel`) and passes everything down from the hook.

### 2. Rust Shell (`src-tauri/src/lib.rs`)
Exposes three Tauri commands to the frontend:
- `get_app_info` — returns platform, version, and which Node runtime was found
- `run_batch` — spawns a Node child process, writes the `BatchJobRequest` to its stdin as JSON, reads NDJSON progress lines from stdout, and re-emits each line as a `batch-progress` Tauri event
- `cancel_batch` — kills the child process by job ID

Active jobs are tracked in `ProcessorState` (an `Arc<Mutex<HashMap>>` of child processes). The Rust layer never does image work itself; it only manages the Node subprocess lifecycle.

The system tray (left-click toggles visibility, right-click shows menu) is configured in `lib.rs::run()`.

### 3. Node Processor (`processor/`)
A standalone Node.js CLI (`processor/src/cli.ts`) that reads a `BatchJobRequest` from stdin and writes NDJSON `ProgressEvent` lines to stdout as it processes each file using `sharp`. Core image logic (format resolution, output path building, suffix normalization) is in `processor/src/core.ts` and has unit tests in `core.test.ts`.

### Runtime bundling
`scripts/prepare-runtime.mjs` copies the current Node binary and the built processor (with `node_modules`) into `src-tauri/resources/runtime/` before the Tauri build. The Rust layer prefers this bundled runtime; it falls back to the development path (`../processor`) and finally to system `node` if neither exists.

### Data flow
```
React UI
  → invoke("run_batch", request)
  → Rust: spawns Node child, writes request JSON to stdin
  → Node: processes files, emits NDJSON progress to stdout
  → Rust: parses stdout lines, emits "batch-progress" Tauri events
  → React: listen("batch-progress") updates file queue state
```

### Shared types
`src/types.ts` defines the frontend-side TypeScript types (`BatchOptions`, `QueueFile`, `BatchProgressEvent`, `AppInfo`). `processor/src/core.ts` defines the processor-side equivalents. These must stay in sync manually — there is no code generation between them.
