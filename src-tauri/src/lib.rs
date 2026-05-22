use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, Default)]
struct ProcessorState {
    jobs: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchJobRequest {
    job_id: String,
    files: Vec<String>,
    options: BatchOptions,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchOptions {
    output_format: String,
    quality: Option<u8>,
    png_compression_level: Option<u8>,
    resize: Option<ResizeOptions>,
    metadata: String,
    filename_suffix: String,
    output_directory: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct ResizeOptions {
    width: Option<u32>,
    height: Option<u32>,
    fit: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BatchProgressEvent {
    job_id: String,
    file_path: String,
    status: String,
    progress_index: usize,
    total_files: usize,
    result: Option<ProcessedFileResult>,
    error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProcessedFileResult {
    input_path: String,
    output_path: String,
    original_bytes: u64,
    output_bytes: u64,
    saved_bytes: u64,
    saved_percent: f64,
    duration_ms: u64,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    platform: String,
    version: String,
    processor_mode: String,
}

fn runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map_err(|error| error.to_string())
        .map(|path| path.join("runtime"))
}

fn development_runtime_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("runtime")
}

fn bundled_node_path(runtime_root: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        runtime_root.join("node").join("node.exe")
    } else {
        runtime_root.join("node").join("node")
    }
}

fn processor_entry_path(runtime_root: &Path) -> PathBuf {
    runtime_root
        .join("processor")
        .join("dist")
        .join("cli.js")
}

fn processor_working_dir(runtime_root: &Path) -> PathBuf {
    runtime_root.join("processor")
}

fn resolve_runtime(app: &AppHandle) -> Result<(PathBuf, String), String> {
    if let Ok(runtime) = runtime_root(app) {
        let bundled_node = bundled_node_path(&runtime);

        if bundled_node.exists() {
            return Ok((bundled_node, String::from("bundled")));
        }
    }

    let dev_runtime = development_runtime_root();
    let bundled_node = bundled_node_path(&dev_runtime);
    if bundled_node.exists() {
        return Ok((bundled_node, String::from("bundled")));
    }

    let system_node = env::var_os("PATH")
        .map(|_| PathBuf::from("node"))
        .ok_or_else(|| String::from("Unable to resolve Node runtime"))?;

    Ok((system_node, String::from("system-node")))
}

fn parse_stdout(stdout: ChildStdout, app: AppHandle) -> Result<(), String> {
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line.map_err(|error| error.to_string())?;
        let event: BatchProgressEvent =
            serde_json::from_str(&line).map_err(|error| error.to_string())?;
        app.emit("batch-progress", event)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_app_info(app: AppHandle) -> Result<AppInfo, String> {
    let (_, processor_mode) = resolve_runtime(&app)?;
    Ok(AppInfo {
        platform: env::consts::OS.to_string(),
        version: app.package_info().version.to_string(),
        processor_mode,
    })
}

#[tauri::command]
fn run_batch(
    app: AppHandle,
    state: State<'_, ProcessorState>,
    request: BatchJobRequest,
) -> Result<(), String> {
    let (node_binary, _) = resolve_runtime(&app)?;
    let runtime = runtime_root(&app)
        .ok()
        .filter(|path| path.exists())
        .unwrap_or_else(development_runtime_root);
    let processor_entry = if processor_entry_path(&runtime).exists() {
        processor_entry_path(&runtime)
    } else {
        PathBuf::from("../processor/dist/cli.js")
    };
    let working_dir = if processor_working_dir(&runtime).exists() {
        processor_working_dir(&runtime)
    } else {
        PathBuf::from("../processor")
    };

    let mut child = Command::new(node_binary)
        .arg(processor_entry)
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| String::from("Unable to capture processor output"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| String::from("Unable to open processor input"))?;

    let child_ref = Arc::new(Mutex::new(child));
    {
        let mut jobs = state.jobs.lock().map_err(|error| error.to_string())?;
        jobs.insert(request.job_id.clone(), child_ref.clone());
    }

    let request_json =
        serde_json::to_string(&request).map_err(|error| error.to_string())?;
    let app_for_reader = app.clone();
    let jobs_for_cleanup = state.jobs.clone();
    let job_id = request.job_id.clone();

    std::thread::spawn(move || {
        let mut stdin = stdin;
        let _ = stdin.write_all(request_json.as_bytes());
        drop(stdin);

        let parse_result = parse_stdout(stdout, app_for_reader.clone());
        let exit_status = child_ref
            .lock()
            .map_err(|error| error.to_string())
            .and_then(|mut child| child.wait().map_err(|error| error.to_string()));

        if let Err(error) = parse_result {
            let _ = app_for_reader.emit(
                "batch-progress",
                BatchProgressEvent {
                    job_id: job_id.clone(),
                    file_path: String::new(),
                    status: String::from("failed"),
                    progress_index: 0,
                    total_files: 0,
                    result: None,
                    error: Some(error),
                },
            );
        }

        if let Err(error) = exit_status {
            let _ = app_for_reader.emit(
                "batch-progress",
                BatchProgressEvent {
                    job_id: job_id.clone(),
                    file_path: String::new(),
                    status: String::from("failed"),
                    progress_index: 0,
                    total_files: 0,
                    result: None,
                    error: Some(error),
                },
            );
        }

        if let Ok(mut jobs) = jobs_for_cleanup.lock() {
            jobs.remove(&job_id);
        }
    });

    Ok(())
}

#[tauri::command]
fn cancel_batch(state: State<'_, ProcessorState>, job_id: String) -> Result<(), String> {
    let jobs = state.jobs.lock().map_err(|error| error.to_string())?;
    let child = jobs
        .get(&job_id)
        .ok_or_else(|| String::from("No running batch for the provided job id"))?;
    let mut child = child.lock().map_err(|error| error.to_string())?;
    child.kill().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ProcessorState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            run_batch,
            cancel_batch
        ])
        .run(tauri::generate_context!())
        .expect("error while running sharpify");
}
