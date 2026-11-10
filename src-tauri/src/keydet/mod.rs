mod audio;
mod cqt;
mod label;
mod model;

use std::path::Path;

pub use label::{LabelPair, LabelProposal, LabelReport};
pub(crate) use label::existing_key;
pub(crate) use cqt::MODEL_BINS;
pub use model::KeyResult;
pub(crate) use audio::TARGET_RATE;

/// The mono analysis window shared by key detection, rhythm and similarity.
pub(crate) fn window(path: &Path) -> Result<Vec<f32>, String> {
    audio::read_window(path)
}

/// The CQT feature matrix for one window, shared by key detection and similarity.
pub(crate) fn timbre(samples: &[f32]) -> Vec<f32> {
    cqt::features(samples)
}

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

/// One local file analysed for the catalogue loop matcher.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLoopAnalysis {
    pub path: String,
    pub name: String,
    pub key: Option<String>,
    pub bpm: Option<u32>,
    pub duration_ms: u64,
}

/// Local key and rhythm analysis reads WAV files only.
fn is_supported_loop(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
}

/// Detects the key and tempo of a loop the user dropped into the matcher.
#[tauri::command]
pub async fn analyze_local_loop(path: String) -> Result<LocalLoopAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = Path::new(&path);
        if !is_supported_loop(file) {
            return Err("Loop matching supports WAV files only.".to_string());
        }

        let name = file
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("that file name is not valid UTF-8")?
            .to_string();

        let key = analyze(file).ok().map(|result| result.label);
        if key.is_none() {
            return Err(format!("cannot analyse {}; is it a valid WAV file?", file.display()));
        }

        // The file name is the cheap source; fall back to the rhythm detector
        // when the name carries no tempo.
        let bpm = crate::library::parse_bpm(&name)
            .or_else(|| window(file).ok().and_then(|samples| crate::rhythm::analyze(&samples, TARGET_RATE).bpm));

        Ok(LocalLoopAnalysis {
            path: path.clone(),
            name,
            key,
            bpm,
            duration_ms: crate::library::duration_ms(file),
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loop_matching_is_wav_only() {
        assert!(is_supported_loop(Path::new("C:/loops/kick.wav")));
        assert!(is_supported_loop(Path::new("C:/loops/kick.WAV")));
        assert!(!is_supported_loop(Path::new("C:/loops/kick.aiff")));
        assert!(!is_supported_loop(Path::new("C:/loops/kick.mp3")));
        assert!(!is_supported_loop(Path::new("C:/loops/kick")));
    }

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
