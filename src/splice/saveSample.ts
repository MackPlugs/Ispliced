import { fetch } from "@tauri-apps/plugin-http";
import { join } from "@tauri-apps/api/path";
import { SpliceSample } from "./api";
import { decodeSpliceAudio } from "./decoder";
import { decodeToWav } from "./export";
import { IS_WINDOWS, WINDOWS_MAX_PATH, writeSampleFile } from "../native";

/** Save the same decoded, 24-bit WAV audio used by individual sample exports. */
export async function savePackSample(sample: SpliceSample, relativePath: string, folder: string, trimDelay: boolean) {
  if (IS_WINDOWS && (await join(folder, relativePath)).length > WINDOWS_MAX_PATH) {
    throw new Error("The file path is too long. Choose a shorter sample folder in Settings.");
  }

  const preview = sample.files.find(file => file.asset_file_type_slug === "preview_mp3");
  if (!preview) throw new Error("No downloadable preview is available.");

  const response = await fetch(preview.url);
  if (!response.ok) throw new Error(`Audio download failed (HTTP ${response.status}).`);

  const decoded = decodeSpliceAudio(new Uint8Array(await response.arrayBuffer()));
  await writeSampleFile(folder, relativePath, await decodeToWav(decoded, sample.duration, trimDelay));
}
