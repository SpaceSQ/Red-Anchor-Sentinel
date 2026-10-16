use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct LinkChild(Mutex<Option<std::process::Child>>);

fn spawn_link(app: &tauri::AppHandle) -> Option<std::process::Child> {
    let script = script_path(app, "link.mjs");
    if !script.exists() {
        return None;
    }
    let mut command = Command::new(node_executable());
    command.arg(script).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    apply_mail_env(&mut command);
    command.spawn().ok()
}

fn process_is_link(pid: u32) -> bool {
    let output = if cfg!(windows) {
        Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine")])
            .output()
    } else {
        Command::new("ps").args(["-p", &pid.to_string(), "-o", "command="]).output()
    };
    let Ok(output) = output else {
        return false;
    };
    String::from_utf8_lossy(&output.stdout).contains("link.mjs")
}

fn stop_recorded_link() {
    let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) else {
        return;
    };
    let pid_path = PathBuf::from(home).join("RedAnchorVault").join("link.pid");
    let Ok(text) = std::fs::read_to_string(&pid_path) else {
        return;
    };
    let Ok(pid) = text.trim().parse::<u32>() else {
        return;
    };
    if !process_is_link(pid) {
        return;
    }
    let _ = if cfg!(windows) {
        Command::new("taskkill").args(["/PID", &pid.to_string(), "/F"]).status()
    } else {
        Command::new("kill").arg(pid.to_string()).status()
    };
}

fn node_executable() -> String {
    let candidates: &[&str] = if cfg!(windows) {
        &[r"C:\Program Files\nodejs\node.exe"]
    } else {
        &["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"]
    };
    for candidate in candidates {
        if PathBuf::from(candidate).exists() {
            return (*candidate).to_string();
        }
    }
    "node".to_string()
}

fn bundled_script(dir: &std::path::Path, name: &str) -> Option<PathBuf> {
    for relative in [format!("_up_/server/{name}"), format!("server/{name}")] {
        let candidate = dir.join(relative);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn script_path(app: &tauri::AppHandle, name: &str) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        if let Some(script) = bundled_script(&dir, name) {
            return script;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(contents) = exe.parent().and_then(|dir| dir.parent()) {
            if let Some(script) = bundled_script(&contents.join("Resources"), name) {
                return script;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../server").join(name)
}

fn apply_mail_env(command: &mut Command) {
    let mut files = Vec::new();
    files.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env"));
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let home = PathBuf::from(home);
        files.push(home.join("RedAnchor").join(".env"));
        files.push(home.join("RedAnchorVault").join(".env"));
    }
    for file in files {
        let Ok(text) = std::fs::read_to_string(file) else {
            continue;
        };
        for line in text.lines() {
            let raw = line.trim();
            if raw.is_empty() || raw.starts_with('#') || !raw.contains('=') {
                continue;
            }
            let Some((key, value)) = raw.split_once('=') else {
                continue;
            };
            if matches!(key, "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_SECURE") {
                let value = value.trim();
                if !value.is_empty() {
                    command.env(key, value);
                }
            }
        }
    }
}

#[tauri::command]
fn host_op(app: tauri::AppHandle, op: String, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let script = script_path(&app, "host-cli.mjs");
    if !script.exists() {
        return Err("打包后的桌面壳需要随包附带 server/host-cli.mjs。开发态请从仓库根目录启动。".into());
    }
    let mut child = Command::new(node_executable());
    child.arg(&script).arg(&op).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    apply_mail_env(&mut child);
    let mut child = child
        .spawn()
        .map_err(|error| format!("需要本机 Node 才能执行驻留命令: {error}"))?;
    if let Some(stdin) = child.stdin.as_mut() {
        let payload = serde_json::to_vec(&body).unwrap_or_else(|_| b"{}".to_vec());
        stdin.write_all(&payload).map_err(|error| error.to_string())?;
    }
    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(LinkChild(Mutex::new(spawn_link(app.handle()))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![host_op])
        .build(tauri::generate_context!())
        .expect("红锚哨兵桌面壳启动失败")
        .run(|app, event| {
            if !matches!(event, RunEvent::Exit) {
                return;
            }
            if let Some(state) = app.try_state::<LinkChild>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.as_mut() {
                        let _ = child.kill();
                    }
                }
            }
            stop_recorded_link();
        });
}
