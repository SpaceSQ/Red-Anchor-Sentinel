use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Manager;

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

fn bundled_script(dir: &std::path::Path) -> Option<PathBuf> {
    for relative in ["_up_/server/host-cli.mjs", "server/host-cli.mjs"] {
        let candidate = dir.join(relative);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn host_script(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        if let Some(script) = bundled_script(&dir) {
            return script;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(contents) = exe.parent().and_then(|dir| dir.parent()) {
            if let Some(script) = bundled_script(&contents.join("Resources")) {
                return script;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../server/host-cli.mjs")
}

fn apply_mail_env(command: &mut Command) {
    let mut files = Vec::new();
    files.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env"));
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        files.push(PathBuf::from(home).join("RedAnchorVault").join(".env"));
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
    let script = host_script(&app);
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
        .invoke_handler(tauri::generate_handler![host_op])
        .run(tauri::generate_context!())
        .expect("红锚哨兵桌面壳启动失败");
}
