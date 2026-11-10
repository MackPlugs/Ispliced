import { fetch } from "@tauri-apps/plugin-http";

import { SpliceSample } from "./api";
import { decodeSpliceAudio } from "./decoder";

/** Enough rows to move back and forth a few times without re-downloading. */
const CACHE_LIMIT = 8;

const decoded = new Map<string, Uint8Array<ArrayBuffer>>();
const pending = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

/**
 * Downloads and unscrambles one preview. Decoded previews are cached by sample id,
 * so the row, the player bar's next/previous buttons and a repeat play all share
 * one download.
 */
export function loadSampleAudio(sample: SpliceSample): Promise<Uint8Array<ArrayBuffer>> {
  const ready = decoded.get(sample.uuid);
  if (ready != null) return Promise.resolve(ready);

  const inFlight = pending.get(sample.uuid);
  if (inFlight != null) return inFlight;

  const job = download(sample)
    .then(bytes => {
      remember(sample.uuid, bytes);
      return bytes;
    })
    .finally(() => pending.delete(sample.uuid));

  pending.set(sample.uuid, job);
  return job;
}

function download(sample: SpliceSample) {
  const file = sample.files.find(entry => entry.asset_file_type_slug == "preview_mp3");
  if (file == null) return Promise.reject(new Error("this sample has no preview audio"));

  return fetch(file.url)
    .then(response => {
      if (!response.ok) throw new Error(`preview download failed (${response.status})`);
      return response.arrayBuffer();
    })
    .then(data => decodeSpliceAudio(new Uint8Array(data)));
}

function remember(uuid: string, bytes: Uint8Array<ArrayBuffer>) {
  decoded.delete(uuid);
  decoded.set(uuid, bytes);

  if (decoded.size <= CACHE_LIMIT) return;
  const oldest = decoded.keys().next().value;
  if (oldest != null) decoded.delete(oldest);
}
