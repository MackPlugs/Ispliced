import * as wav from "node-wav";
import { getMp3SampleRate, MP3_START_DELAY } from "./decoder";

const FALLBACK_SAMPLE_RATE = 44100;
const WAV_BIT_DEPTH = 24;

/**
 * Decodes a Splice preview and encodes the 24-bit PCM WAV written to disk. Both the
 * drag export and the pack downloader call this, so a sample always produces the
 * same file whichever way it leaves the app.
 */
export async function decodeToWav(decoded: Uint8Array, durationMs: number, trimDelay: boolean) {
  const sampleRate = getMp3SampleRate(decoded) ?? FALLBACK_SAMPLE_RATE;
  const context = new OfflineAudioContext(1, 1, sampleRate);

  // decodeAudioData detaches its input, so pass a copy and keep the decoded
  // bytes usable for playback afterwards.
  const audio = await context.decodeAudioData(decoded.slice().buffer);

  const start = trimDelay ? MP3_START_DELAY : 0;
  const end = trimDelay && durationMs > 0
    ? Math.min(audio.length, Math.round(durationMs / 1000 * audio.sampleRate) + start)
    : audio.length;

  if (end <= start || audio.numberOfChannels === 0) {
    throw new Error("The decoded audio is empty.");
  }

  const channels = Array.from({ length: audio.numberOfChannels },
    (_, index) => audio.getChannelData(index).subarray(start, end));

  return wav.encode(channels as unknown as ArrayBuffer[], {
    bitDepth: WAV_BIT_DEPTH,
    sampleRate: audio.sampleRate,
  });
}
