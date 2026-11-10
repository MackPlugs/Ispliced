use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD, Engine};
use fancy_regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use crate::keydet::{self, MODEL_BINS, existing_key};
use crate::rhythm;

const INDEX_FILE: &str = "library.json";
const FAVORITES_FILE: &str = "favorites.json";
const AUDIO_EXTENSIONS: [&str; 8] = ["wav", "aif", "aiff", "flac", "mp3", "ogg", "opus", "m4a"];
const LOOP_DIRECTORY: &str = "Loops";
const ONE_SHOT_DIRECTORY: &str = "One-Shots";
const MIN_BPM: u32 = 1;
const MAX_BPM: u32 = 300;
const PROGRESS_EVERY: usize = 10;
/// Bumped when the embedding layout changes, so old indexes are re-analysed.
const ANALYSIS_VERSION: u32 = 2;
const TIMBRE_WEIGHT: f32 = 0.8;
const RHYTHM_WEIGHT: f32 = 0.2;

static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub path: String,
    pub name: String,
    pub pack: String,
    pub instrument: String,
    pub kind: String,
    pub bpm: Option<u32>,
    pub key: Option<String>,
    pub duration_ms: u64,
    pub bytes: u64,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub modified: u64,
    #[serde(default)]
    pub hash: Option<String>,
    /// Base64 of the file's 192-bin timbre profile plus 8 rhythm values; opaque to the UI.
    #[serde(default)]
    pub embedding: Option<String>,
    /// Which similarity layout `embedding` holds; older indexes are recomputed.
    #[serde(default)]
    pub analysis_version: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryIndex {
    pub folder: String,
    pub scanned_at: u64,
    pub entries: Vec<LibraryEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub processed: usize,
    pub total: usize,
}

/// Indexes every audio file under `folder`, newest scan replacing the stored one.
pub fn scan(folder: &Path) -> Result<LibraryIndex, String> {
    if !folder.is_dir() {
        return Err(format!("{} is not a folder", folder.display()));
    }

    let mut entries = Vec::new();
    walk(folder, folder, &mut entries);
    entries.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(LibraryIndex {
        folder: folder.display().to_string(),
        scanned_at: now_seconds(),
        entries,
    })
}

fn walk(root: &Path, directory: &Path, entries: &mut Vec<LibraryEntry>) {
    let Ok(read) = fs::read_dir(directory) else {
        return;
    };

    for entry in read.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let is_symlink = path
                .symlink_metadata()
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false);

            if !is_symlink {
                walk(root, &path, entries);
            }
        } else if is_audio(&path) {
            entries.push(describe(root, &path));
        }
    }
}

fn describe(root: &Path, path: &Path) -> LibraryEntry {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let parts: Vec<String> = relative
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .map(str::to_string)
        .collect();

    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string();

    let folders = &parts[..parts.len().saturating_sub(1)];
    let pack = folders.first().cloned().unwrap_or_default();
    let instrument = folders.get(1).cloned().unwrap_or_default();
    let kind = classify(folders.get(2).map(String::as_str));
    let metadata = fs::metadata(path).ok();

    LibraryEntry {
        path: path.display().to_string(),
        name: name.clone(),
        pack,
        instrument,
        kind,
        bpm: parse_bpm(&name),
        key: existing_key(&name),
        duration_ms: duration_ms(path),
        bytes: metadata.as_ref().map(|metadata| metadata.len()).unwrap_or(0),
        favorite: false,
        modified: metadata
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0),
        hash: None,
        embedding: None,
        analysis_version: 0,
    }
}

/// Adds the content hash and audio profile when they are missing or stale.
fn enrich(entry: &mut LibraryEntry) {
    let path = Path::new(&entry.path);

    if entry.hash.is_none() {
        entry.hash = hash_file(path).ok();
    }
    if entry.embedding.is_none() || entry.analysis_version != ANALYSIS_VERSION {
        entry.embedding = embed(path);
        entry.analysis_version = if entry.embedding.is_some() { ANALYSIS_VERSION } else { 0 };
    }
}

/// Timbre plus rhythm, so harmonic and rhythmic similarity can be compared separately.
fn embed(path: &Path) -> Option<String> {
    let samples = keydet::window(path).ok()?;
    let mut values = mean_per_bin(&keydet::timbre(&samples));
    if values.len() < MODEL_BINS {
        return None;
    }

    values.extend_from_slice(&rhythm::analyze(&samples, keydet::TARGET_RATE).features);
    Some(encode_embedding(&values))
}

fn hash_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Collapses `[bin][frame]` features into one value per bin.
fn mean_per_bin(features: &[f32]) -> Vec<f32> {
    if features.len() < MODEL_BINS {
        return Vec::new();
    }

    let frames = features.len() / MODEL_BINS;
    (0..MODEL_BINS)
        .map(|bin| {
            let slice = &features[bin * frames..(bin + 1) * frames];
            slice.iter().sum::<f32>() / frames as f32
        })
        .collect()
}

fn encode_embedding(values: &[f32]) -> String {
    let bytes: Vec<u8> = values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect();
    STANDARD.encode(bytes)
}

fn decode_embedding(encoded: &str) -> Option<Vec<f32>> {
    let bytes = STANDARD.decode(encoded).ok()?;
    if bytes.len() % 4 != 0 {
        return None;
    }

    Some(
        bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect(),
    )
}

fn cosine(left: &[f32], right: &[f32]) -> f32 {
    if left.len() != right.len() || left.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0;
    let mut left_norm = 0.0;
    let mut right_norm = 0.0;
    for (a, b) in left.iter().zip(right) {
        dot += a * b;
        left_norm += a * a;
        right_norm += b * b;
    }

    if left_norm <= 0.0 || right_norm <= 0.0 {
        return 0.0;
    }
    dot / (left_norm.sqrt() * right_norm.sqrt())
}

fn classify(folder: Option<&str>) -> String {
    match folder {
        Some(name) if name == LOOP_DIRECTORY => "loop".to_string(),
        Some(name) if name == ONE_SHOT_DIRECTORY => "one-shot".to_string(),
        _ => "other".to_string(),
    }
}

pub(crate) fn duration_ms(path: &Path) -> u64 {
    if !has_extension(path, "wav") {
        return 0;
    }

    let Ok(reader) = hound::WavReader::open(path) else {
        return 0;
    };
    let rate = reader.spec().sample_rate;
    if rate == 0 {
        return 0;
    }

    u64::from(reader.duration()) * 1000 / u64::from(rate)
}

pub(crate) fn parse_bpm(name: &str) -> Option<u32> {
    let file = Path::new(name)
        .file_name()
        .and_then(|file| file.to_str())
        .unwrap_or(name);

    if let Some(captures) = bpm_pattern().captures(file).ok().flatten() {
        let bpm: u32 = captures.get(1)?.as_str().parse().ok()?;
        return (MIN_BPM..=MAX_BPM).contains(&bpm).then_some(bpm);
    }

    standalone_bpm(file)
}

/// Splice names carry the tempo as a bare token (`STCR2_DMDH_125_Vocal`). Only
/// accept 2-3 digit tokens in the loop range so `808` and years are ignored.
fn standalone_bpm(file: &str) -> Option<u32> {
    let stem = Path::new(file)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file);

    stem.split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| (2..=3).contains(&token.len()) && token.bytes().all(|byte| byte.is_ascii_digit()))
        .filter_map(|token| token.parse::<u32>().ok())
        .find(|bpm| (70..=190).contains(bpm))
}

fn bpm_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| Regex::new(r"(?i)(?<![0-9])(\d{2,3})\s?bpm").expect("bpm pattern is valid"))
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| AUDIO_EXTENSIONS.iter().any(|known| extension.eq_ignore_ascii_case(known)))
}

fn has_extension(path: &Path, expected: &str) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(expected))
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(INDEX_FILE))
        .map_err(|error| format!("cannot resolve the app config folder: {error}"))
}

fn save(app: &AppHandle, index: &LibraryIndex) -> Result<(), String> {
    let path = index_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }

    let json = serde_json::to_string(index)
        .map_err(|error| format!("cannot encode the library index: {error}"))?;
    fs::write(&path, json).map_err(|error| format!("cannot write {}: {error}", path.display()))
}

fn load(app: &AppHandle) -> Result<Option<LibraryIndex>, String> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(&path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|error| format!("cannot parse the library index: {error}"))
}

/// Drops the internal audio profile before the index leaves the backend.
fn for_ui(mut index: LibraryIndex) -> LibraryIndex {
    for entry in &mut index.entries {
        entry.embedding = None;
    }
    index
}

#[tauri::command]
pub async fn scan_library(app: AppHandle, folder: String) -> Result<LibraryIndex, String> {
    SCAN_CANCELLED.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn_blocking(move || {
        let previous = load(&app)?;
        let mut index = scan(Path::new(&folder))?;
        let favorites = load_favorites(&app);
        apply_favorites(&mut index, &favorites);
        carry_analysis(&mut index, previous.as_ref());

        let total = index.entries.len();
        for (processed, entry) in index.entries.iter_mut().enumerate() {
            if SCAN_CANCELLED.load(Ordering::SeqCst) {
                return Err("Library scan cancelled".to_string());
            }

            enrich(entry);
            if processed % PROGRESS_EVERY == 0 || processed + 1 == total {
                let _ = app.emit("library-scan-progress", ScanProgress { processed: processed + 1, total });
            }
        }

        save(&app, &index)?;
        Ok(for_ui(index))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn cancel_library_scan() {
    SCAN_CANCELLED.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn load_library(app: AppHandle) -> Result<Option<LibraryIndex>, String> {
    let Some(mut index) = load(&app)? else {
        return Ok(None);
    };

    apply_favorites(&mut index, &load_favorites(&app));
    Ok(Some(for_ui(index)))
}

#[tauri::command]
pub fn set_library_favorite(app: AppHandle, path: String, favorite: bool) -> Result<LibraryIndex, String> {
    let mut index = load(&app)?.ok_or("scan the library first")?;
    if !index.entries.iter().any(|entry| entry.path == path) {
        return Err("that file is not in the library index".to_string());
    }

    let mut favorites = load_favorites(&app);
    update_favorite(&mut favorites, &path, favorite);
    save_favorites(&app, &favorites)?;

    apply_favorites(&mut index, &favorites);
    Ok(for_ui(index))
}

fn update_favorite(favorites: &mut HashSet<String>, path: &str, favorite: bool) {
    if favorite {
        favorites.insert(path.to_string());
    } else {
        favorites.remove(path);
    }
}

fn favorites_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(FAVORITES_FILE))
        .map_err(|error| format!("cannot resolve the app config folder: {error}"))
}

fn load_favorites(app: &AppHandle) -> HashSet<String> {
    let Ok(path) = favorites_path(app) else {
        return HashSet::new();
    };

    match fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => migrate_favorites(app),
    }
}

/// Moves favourites stored inside an older index into the separate file.
fn migrate_favorites(app: &AppHandle) -> HashSet<String> {
    let favorites: HashSet<String> = load(app)
        .ok()
        .flatten()
        .map(|index| {
            index.entries.into_iter()
                .filter(|entry| entry.favorite)
                .map(|entry| entry.path)
                .collect()
        })
        .unwrap_or_default();

    if !favorites.is_empty() {
        let _ = save_favorites(app, &favorites);
    }
    favorites
}

fn save_favorites(app: &AppHandle, favorites: &HashSet<String>) -> Result<(), String> {
    let path = favorites_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }

    let json = serde_json::to_string(favorites)
        .map_err(|error| format!("cannot encode the favourites: {error}"))?;
    fs::write(&path, json).map_err(|error| format!("cannot write {}: {error}", path.display()))
}

fn apply_favorites(index: &mut LibraryIndex, favorites: &HashSet<String>) {
    for entry in &mut index.entries {
        entry.favorite = favorites.contains(&entry.path);
    }
}

/// Keeps cached analysis when the file has not changed since the last scan.
fn carry_analysis(index: &mut LibraryIndex, previous: Option<&LibraryIndex>) {
    let Some(previous) = previous else {
        return;
    };

    let cached: HashMap<&str, &LibraryEntry> = previous
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();

    for entry in &mut index.entries {
        let Some(old) = cached.get(entry.path.as_str()) else {
            continue;
        };
        if old.bytes != entry.bytes || old.modified != entry.modified {
            continue;
        }

        entry.hash.clone_from(&old.hash);
        entry.embedding.clone_from(&old.embedding);
        entry.analysis_version = old.analysis_version;
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarMatch {
    pub path: String,
    pub name: String,
    pub pack: String,
    pub instrument: String,
    pub score: f32,
}

fn similar(index: &LibraryIndex, path: &str, limit: usize, mode: &str) -> Result<Vec<SimilarMatch>, String> {
    let target = index
        .entries
        .iter()
        .find(|entry| entry.path == path)
        .ok_or("that file is not in the library index")?;

    let target = target
        .embedding
        .as_deref()
        .and_then(decode_embedding)
        .ok_or("that file has no audio analysis yet; scan the folder again")?;

    let mut matches: Vec<SimilarMatch> = index
        .entries
        .iter()
        .filter(|entry| entry.path != path)
        .filter_map(|entry| {
            let candidate = decode_embedding(entry.embedding.as_deref()?)?;
            Some(SimilarMatch {
                path: entry.path.clone(),
                name: entry.name.clone(),
                pack: entry.pack.clone(),
                instrument: entry.instrument.clone(),
                score: similarity(&target, &candidate, mode),
            })
        })
        .collect();

    matches.sort_by(|left, right| right.score.total_cmp(&left.score));
    matches.truncate(limit);
    Ok(matches)
}

/// `harmonic` compares timbre, `rhythmic` compares the 8 rhythm values, and
/// `combined` weights both. Profiles from an older scan have no rhythm values,
/// so combined falls back to the timbre score.
fn similarity(target: &[f32], candidate: &[f32], mode: &str) -> f32 {
    let (target_timbre, target_rhythm) = split_embedding(target);
    let (candidate_timbre, candidate_rhythm) = split_embedding(candidate);
    let harmonic = cosine(target_timbre, candidate_timbre);
    let rhythmic = cosine(target_rhythm, candidate_rhythm);

    match mode {
        "harmonic" => harmonic,
        "rhythmic" => rhythmic,
        _ if target_rhythm.is_empty() || candidate_rhythm.is_empty() => harmonic,
        _ => TIMBRE_WEIGHT * harmonic + RHYTHM_WEIGHT * rhythmic,
    }
}

fn split_embedding(values: &[f32]) -> (&[f32], &[f32]) {
    if values.len() > MODEL_BINS {
        values.split_at(MODEL_BINS)
    } else {
        (values, &[])
    }
}

#[tauri::command]
pub fn find_similar(app: AppHandle, path: String, limit: usize, mode: Option<String>) -> Result<Vec<SimilarMatch>, String> {
    let index = load(&app)?.ok_or("scan the library first")?;
    similar(&index, &path, limit, mode.as_deref().unwrap_or("combined"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_bpm_from_the_name() {
        assert_eq!(parse_bpm("kick 128 BPM.wav"), Some(128));
        assert_eq!(parse_bpm("kick_90bpm.wav"), Some(90));
        assert_eq!(parse_bpm("loop 999 bpm.wav"), None);
    }

    #[test]
    fn falls_back_to_a_bare_bpm_token() {
        assert_eq!(parse_bpm("NN_120_synth_loop.wav"), Some(120));
        assert_eq!(parse_bpm("STCR2_DMDH_125_Vocal_YouGotMe_Gm.wav"), Some(125));
        assert_eq!(parse_bpm("C:/Samples/Pack/Drums/Loops/CJD_174_break_loop.wav"), Some(174));
        assert_eq!(parse_bpm("808_kit_hit.wav"), None);
        assert_eq!(parse_bpm("loop_2020.wav"), None);
        assert_eq!(parse_bpm("take_5_loop.wav"), None);
    }

    #[test]
    fn classifies_the_download_layout() {
        let entry = describe(
            Path::new("C:/Samples"),
            Path::new("C:/Samples/Pack/Drums/Loops/kick 128 BPM.wav"),
        );

        assert_eq!(entry.pack, "Pack");
        assert_eq!(entry.instrument, "Drums");
        assert_eq!(entry.kind, "loop");
        assert_eq!(entry.bpm, Some(128));
    }

    #[test]
    fn one_shots_are_classified() {
        let entry = describe(
            Path::new("C:/Samples"),
            Path::new("C:/Samples/Pack/Drums/One-Shots/snare.wav"),
        );
        assert_eq!(entry.kind, "one-shot");
    }

    #[test]
    fn files_outside_the_layout_have_no_pack() {
        let entry = describe(Path::new("C:/Samples"), Path::new("C:/Samples/loose.wav"));
        assert!(entry.pack.is_empty());
        assert!(entry.instrument.is_empty());
        assert_eq!(entry.kind, "other");
    }

    #[test]
    fn favourites_survive_a_rescan() {
        let path = Path::new("C:/Samples/Pack/Drums/Loops/kick.wav");
        let mut favorites = HashSet::new();
        update_favorite(&mut favorites, "C:/Samples/Pack/Drums/Loops/kick.wav", true);

        let mut rescanned = index_with(path);
        apply_favorites(&mut rescanned, &favorites);

        assert!(rescanned.entries[0].favorite);
    }

    #[test]
    fn a_first_scan_has_no_favourites() {
        let mut scanned = index_with(Path::new("C:/Samples/Pack/Drums/Loops/kick.wav"));
        apply_favorites(&mut scanned, &HashSet::new());
        assert!(!scanned.entries[0].favorite);
    }

    #[test]
    fn unfavouriting_removes_the_path() {
        let mut favorites = HashSet::new();
        update_favorite(&mut favorites, "C:/Samples/Pack/Drums/Loops/kick.wav", true);
        update_favorite(&mut favorites, "C:/Samples/Pack/Drums/Loops/kick.wav", false);
        assert!(favorites.is_empty());
    }

    #[test]
    fn the_ui_index_hides_embeddings() {
        let mut index = index_with(Path::new("C:/Samples/Pack/Drums/Loops/kick.wav"));
        index.entries[0].embedding = Some("abc".to_string());

        assert!(for_ui(index).entries[0].embedding.is_none());
    }

    #[test]
    fn hashes_file_contents() {
        let root = std::env::temp_dir().join(format!("ispliced-hash-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let file = root.join("sample.bin");
        std::fs::write(&file, b"hello world").unwrap();

        let hash = hash_file(&file).unwrap();
        assert_eq!(hash.len(), 64);
        assert_eq!(hash, hash_file(&file).unwrap());

        std::fs::remove_dir_all(&root).ok();
    }

    fn index_with(path: &Path) -> LibraryIndex {
        LibraryIndex {
            folder: "C:/Samples".to_string(),
            scanned_at: 0,
            entries: vec![describe(Path::new("C:/Samples"), path)],
        }
    }

    fn entry_with(path: &str, embedding: &[f32]) -> LibraryEntry {
        let mut entry = describe(Path::new("C:/Samples"), Path::new(path));
        entry.embedding = Some(encode_embedding(embedding));
        entry
    }

    #[test]
    fn cosine_compares_profiles() {
        let profile = [0.2, 0.4, 0.6];
        assert!((cosine(&profile, &profile) - 1.0).abs() < 1e-6);
        assert!(cosine(&profile, &[0.0, 0.0, 0.0]).abs() < 1e-6);
    }

    #[test]
    fn mean_per_bin_averages_each_bin_over_time() {
        let mut features = vec![0.0f32; MODEL_BINS * 2];
        features[0] = 1.0;
        features[1] = 3.0;
        features[2] = 2.0;
        features[3] = 2.0;

        let means = mean_per_bin(&features);
        assert_eq!(means[0], 2.0);
        assert_eq!(means[1], 2.0);
    }

    #[test]
    fn similar_ranks_the_closest_profile_first() {
        let index = LibraryIndex {
            folder: "C:/Samples".to_string(),
            scanned_at: 0,
            entries: vec![
                entry_with("C:/Samples/Pack/Drums/Loops/target.wav", &[1.0, 0.0, 0.0]),
                entry_with("C:/Samples/Pack/Drums/Loops/far.wav", &[0.0, 1.0, 0.0]),
                entry_with("C:/Samples/Pack/Drums/Loops/near.wav", &[0.9, 0.1, 0.0]),
            ],
        };

        let matches = similar(&index, "C:/Samples/Pack/Drums/Loops/target.wav", 2, "combined").unwrap();
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].name, "near.wav");
        assert!(matches[1].score < matches[0].score);
    }

    #[test]
    fn similarity_modes_weight_timbre_and_rhythm() {
        let mut target = vec![0.0f32; MODEL_BINS];
        target[0] = 1.0;
        target.extend_from_slice(&[1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

        let mut same_timbre = target.clone();
        same_timbre[MODEL_BINS..].copy_from_slice(&[0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

        let mut same_rhythm = vec![0.0f32; MODEL_BINS];
        same_rhythm[1] = 1.0;
        same_rhythm.extend_from_slice(&target[MODEL_BINS..]);

        assert!((similarity(&target, &same_timbre, "harmonic") - 1.0).abs() < 1e-6);
        assert!((similarity(&target, &same_timbre, "rhythmic")).abs() < 1e-6);
        assert!((similarity(&target, &same_rhythm, "rhythmic") - 1.0).abs() < 1e-6);
        assert!(similarity(&target, &same_timbre, "combined") > 0.7);
    }

    #[test]
    fn combined_falls_back_to_timbre_for_old_profiles() {
        let target = [1.0, 0.0, 0.0];
        assert!((similarity(&target, &target, "combined") - 1.0).abs() < 1e-6);
    }

    #[test]
    fn similar_needs_an_indexed_profile() {
        let index = index_with(Path::new("C:/Samples/Pack/Drums/Loops/kick.wav"));
        assert!(similar(&index, "C:/Samples/Pack/Drums/Loops/kick.wav", 5, "combined").is_err());
    }

    #[test]
    fn carry_analysis_keeps_unchanged_files_only() {
        let path = Path::new("C:/Samples/Pack/Drums/Loops/kick.wav");
        let mut previous = index_with(path);
        previous.entries[0].hash = Some("abc".to_string());
        previous.entries[0].embedding = Some("xyz".to_string());

        let mut unchanged = index_with(path);
        unchanged.entries[0].bytes = previous.entries[0].bytes;
        unchanged.entries[0].modified = previous.entries[0].modified;
        carry_analysis(&mut unchanged, Some(&previous));
        assert_eq!(unchanged.entries[0].hash.as_deref(), Some("abc"));

        let mut changed = index_with(path);
        changed.entries[0].bytes = previous.entries[0].bytes + 1;
        carry_analysis(&mut changed, Some(&previous));
        assert!(changed.entries[0].hash.is_none());
    }

    #[test]
    fn scan_indexes_audio_and_skips_other_files() {        let root = std::env::temp_dir().join(format!("ispliced-library-{}", std::process::id()));
        let loops = root.join("Pack").join("Drums").join("Loops");
        std::fs::create_dir_all(&loops).unwrap();
        write_wav(&loops.join("kick 128 BPM.wav"));
        std::fs::write(root.join("notes.txt"), b"ignored").unwrap();

        let index = scan(&root).unwrap();
        assert_eq!(index.entries.len(), 1);
        assert_eq!(index.entries[0].pack, "Pack");
        assert_eq!(index.entries[0].duration_ms, 1000);

        std::fs::remove_dir_all(&root).ok();
    }

    fn write_wav(path: &Path) {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(path, spec).unwrap();
        for _ in 0..44100 {
            writer.write_sample(0i16).unwrap();
        }
        writer.finalize().unwrap();
    }
}
