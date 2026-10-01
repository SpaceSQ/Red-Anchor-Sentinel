use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[tauri::command]
fn host_op(op: String, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../server/host-cli.mjs");
    if !script.exists() {
        return Err("打包后的桌面壳需要随包附带 server/host-cli.mjs。开发态请从仓库根目录启动。".into());
    }
    let mut child = Command::new("node")
        .arg(&script)
        .arg(&op)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
