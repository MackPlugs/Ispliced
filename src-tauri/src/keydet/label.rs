use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use fancy_regex::Regex;
use serde::{Deserialize, Serialize};

use super::analyze;

const LOOP_DIRECTORY: &str = "Loops";
const LABEL_SEPARATOR: &str = " ";
const CONFIDENCE_RANK: [(&str, u8); 3] = [("low", 0), ("medium", 1), ("high", 2)];

// Mirrors MackListener's notation.py so a name this app treats as unlabelled matches
// the names its detector treats as unlabelled.
const SCALE_NAMES: &str = "harmonic minor|melodic minor|natural minor|major pentatonic|minor pentatonic|dorian|phrygian|lydian|mixolydian|pentatonic|blues";
const MODE_PATTERNS: &str = "maj(?:or)?|min(?:or)?|m";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelProposal {
    pub path: String,
    pub name: String,
    pub new_name: String,
    pub label: String,
    pub confidence: String,
    pub probability: f32,
    /// Empty when the rename can be applied; otherwise why it cannot.
    pub reason: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPair {
    pub path: String,
    pub new_name: String,
}

#[derive(Debug, Serialize)]
pub struct LabelFailure {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct LabelReport {
    pub renamed: Vec<String>,
    pub failed: Vec<LabelFailure>,
}

/// Proposals for every loop under `folder`, including the ones that must be skipped.
pub fn plan_labels(folder: &Path, min_confidence: &str) -> Result<Vec<LabelProposal>, String> {
    if !folder.is_dir() {
        return Err(format!("{} is not a folder", folder.display()));
    }

    Ok(loop_files(folder).into_iter().map(|path| decide(&path, min_confidence)).collect())
}

pub fn apply_labels(pairs: Vec<LabelPair>) -> LabelReport {
    let mut renamed = Vec::new();
    let mut failed = Vec::new();

    for pair in pairs {
        if pair.new_name.contains(['/', '\\']) || pair.new_name.trim().is_empty() {
            failed.push(LabelFailure { path: pair.path, reason: "invalid file name".to_string() });
            continue;
        }

        let source = PathBuf::from(&pair.path);
        let target = source.with_file_name(&pair.new_name);
        match fs::rename(&source, &target) {
            Ok(()) => renamed.push(target.display().to_string()),
            Err(error) => failed.push(LabelFailure { path: pair.path, reason: error.to_string() }),
        }
    }

    LabelReport { renamed, failed }
}

fn decide(path: &Path, min_confidence: &str) -> LabelProposal {
    let name = file_name(path);
    let base = LabelProposal {
        path: path.display().to_string(),
        name: name.clone(),
        new_name: String::new(),
        label: String::new(),
        confidence: String::new(),
        probability: 0.0,
        reason: String::new(),
    };

    if has_existing_label(&name) {
        return LabelProposal { reason: "already labelled".to_string(), ..base };
    }

    let detection = match analyze(path) {
        Ok(detection) => detection,
        Err(error) => return LabelProposal { reason: error, ..base },
    };

    let detected = LabelProposal {
        label: detection.label.clone(),
        confidence: detection.confidence.clone(),
        probability: detection.probability,
        ..base
    };

    if rank(&detection.confidence) < rank(min_confidence) {
        return LabelProposal { reason: "confidence below threshold".to_string(), ..detected };
    }

    let new_name = labelled_name(&name, &detection.label);
    if new_name == name {
        return LabelProposal { reason: "already named".to_string(), ..detected };
    }
    if path.with_file_name(&new_name).exists() {
        return LabelProposal { new_name, reason: "target name exists".to_string(), ..detected };
    }

    LabelProposal { new_name, ..detected }
}

fn labelled_name(name: &str, label: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, extension)) => format!("{stem}{LABEL_SEPARATOR}{label}.{extension}"),
        None => format!("{name}{LABEL_SEPARATOR}{label}"),
    }
}

fn has_existing_label(name: &str) -> bool {
    label_pattern().is_match(name).unwrap_or(false)
}

/// The key or scale stated in a name, formatted the way this app writes it.
pub(crate) fn existing_key(name: &str) -> Option<String> {
    let captures = label_pattern().captures(name).ok()??;
    let note = captures.get(1)?.as_str().to_uppercase();
    let accidental = captures.get(2).map(|part| part.as_str()).unwrap_or("");
    let tag = captures.get(3)?.as_str().to_lowercase();

    let mode = if tag.starts_with("maj") {
        "maj"
    } else if tag == "m" || tag.starts_with("min") {
        "min"
    } else {
        return Some(format!("{note}{accidental} {}", capitalise(&tag)));
    };

    Some(format!("{note}{accidental}{mode}"))
}

fn capitalise(value: &str) -> String {
    let mut characters = value.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
        None => String::new(),
    }
}

fn label_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        let pattern = format!(
            r"(?i)(?<![A-Za-z0-9])([A-G])(#|b)?[ _]?({SCALE_NAMES}|{MODE_PATTERNS})(?![A-Za-z0-9])"
        );
        Regex::new(&pattern).expect("label pattern is valid")
    })
}

fn rank(confidence: &str) -> u8 {
    CONFIDENCE_RANK
        .iter()
        .find(|(name, _)| *name == confidence)
        .map(|(_, rank)| *rank)
        .unwrap_or(0)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string()
}

fn loop_files(root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    walk(root, false, &mut found);
    found.sort();
    found
}

fn walk(directory: &Path, inside_loops: bool, found: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let is_loops = path.file_name().and_then(|name| name.to_str()) == Some(LOOP_DIRECTORY);
            walk(&path, inside_loops || is_loops, found);
        } else if inside_loops && is_wav(&path) {
            found.push(path);
        }
    }
}

fn is_wav(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_the_label_before_the_extension() {
        assert_eq!(labelled_name("kick 01.wav", "Amin"), "kick 01 Amin.wav");
        assert_eq!(labelled_name("kick.01.wav", "F#min"), "kick.01 F#min.wav");
    }

    #[test]
    fn detects_names_that_already_carry_a_key() {
        assert!(has_existing_label("Cymatics - Test - 120 BPM D Min.wav"));
        assert!(has_existing_label("C Dorian.wav"));
        assert!(has_existing_label("Loop 8A.wav") == false);
    }

    #[test]
    fn bare_mode_words_do_not_count_as_a_key() {
        assert!(!has_existing_label("Rhodes Dorian.wav"));
        assert!(!has_existing_label("Piano Major.wav"));
    }

    #[test]
    fn plain_names_are_not_labelled() {
        assert!(!has_existing_label("kick_punchy.wav"));
        assert!(!has_existing_label("Ambient Bass Loop 5.wav"));
    }

    #[test]
    fn confidence_ranks_are_ordered() {
        assert!(rank("high") > rank("medium"));
        assert!(rank("medium") > rank("low"));
        assert_eq!(rank("unknown"), 0);
    }

    #[test]
    fn plans_then_renames_a_downloaded_loop() {
        let root = std::env::temp_dir().join(format!("ispliced-labels-{}", std::process::id()));
        let loops = root.join("Pack").join("Drums").join("Loops");
        std::fs::create_dir_all(&loops).unwrap();

        let source = loops.join("kick.wav");
        write_tone(&source);

        let proposals = plan_labels(&root, "low").unwrap();
        assert_eq!(proposals.len(), 1);
        assert_eq!(proposals[0].reason, "");
        assert!(!proposals[0].label.is_empty());

        let report = apply_labels(vec![LabelPair {
            path: proposals[0].path.clone(),
            new_name: proposals[0].new_name.clone(),
        }]);
        assert_eq!(report.renamed.len(), 1);
        assert!(report.failed.is_empty());
        assert!(loops.join(&proposals[0].new_name).exists());

        std::fs::remove_dir_all(&root).ok();
    }

    fn write_tone(path: &Path) {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(path, spec).unwrap();
        for index in 0..44100 * 4 {
            let sample = (2.0 * std::f32::consts::PI * 440.0 * index as f32 / 44100.0).sin() * 0.5;
            writer.write_sample((sample * i16::MAX as f32) as i16).unwrap();
        }
        writer.finalize().unwrap();
    }
}
