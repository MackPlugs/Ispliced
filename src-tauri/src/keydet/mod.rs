mod audio;
mod cqt;
mod label;
mod model;

use std::path::Path;

pub use label::{LabelPair, LabelProposal, LabelReport};
pub use model::KeyResult;

/// Detects the key of one written WAV file.
pub fn analyze(path: &Path) -> Result<KeyResult, String> {
    let samples = audio::read_window(path)?;
    model::classify(&cqt::features(&samples))
}

#[tauri::command]
pub async fn plan_loop_labels(
    folder: String,
    min_confidence: Option<String>,
) -> Result<Vec<LabelProposal>, String> {
    let minimum = min_confidence.unwrap_or_else(|| "high".to_string());
    tauri::async_runtime::spawn_blocking(move || label::plan_labels(Path::new(&folder), &minimum))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn apply_loop_labels(pairs: Vec<LabelPair>) -> Result<LabelReport, String> {
    tauri::async_runtime::spawn_blocking(move || label::apply_labels(pairs))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Manual parity harness against MackListener:
    /// `K10_PARITY_WAV=<file> cargo test parity -- --nocapture`
    #[test]
    fn parity_smoke() {
        let Ok(path) = std::env::var("K10_PARITY_WAV") else {
            return;
        };

        let detection = analyze(Path::new(&path)).expect("analysis");
        println!(
            "PARITY label={} confidence={} probability={:.6}",
            detection.label, detection.confidence, detection.probability
        );
    }
}
