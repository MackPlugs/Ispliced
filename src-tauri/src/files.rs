use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;

/// Resolves `relative_path` under `base_dir` and creates its parent folders.
fn prepare_target(base_dir: &str, relative_path: &str) -> Result<PathBuf, String> {
    let full_path = PathBuf::from(base_dir).join(relative_path);
    let parent = full_path
        .parent()
        .ok_or("Failed to determine parent directory")?;

    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create directories for {}: {e}", parent.display()))?;

    Ok(full_path)
}

#[tauri::command]
pub async fn write_sample_file(base_dir: String, relative_path: String, buffer: Vec<u8>) -> Result<(), String> {
    if !relative_path.ends_with(".wav") {
        return Err("The relative path must end with .wav".into());
    }

    let full_path = prepare_target(&base_dir, &relative_path)?;

    let mut file = File::create(&full_path)
        .map_err(|e| format!("Failed to create {}: {e}", full_path.display()))?;

    file.write_all(&buffer)
        .map_err(|e| format!("Failed to write to {}: {e}", full_path.display()))
}

#[tauri::command]
pub async fn file_exists(base_dir: String, relative_path: String) -> Result<bool, String> {
    Ok(PathBuf::from(base_dir).join(relative_path).exists())
}

#[tauri::command]
pub async fn dir_exists(path: String) -> Result<bool, String> {
    Ok(!path.trim().is_empty() && PathBuf::from(path).is_dir())
}

#[tauri::command]
pub async fn create_placeholder_file(base_dir: String, relative_path: String) -> Result<(), String> {
    let full_path = prepare_target(&base_dir, &relative_path)?;

    File::create(&full_path)
        .map(|_| ())
        .map_err(|e| format!("Failed to create file {}: {e}", full_path.display()))
}
