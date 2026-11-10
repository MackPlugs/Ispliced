import { emit, listen } from "@tauri-apps/api/event";

import { mockSearch } from "../dev/mock";
import { IN_TAURI } from "../native";

const RETRY_INTERVAL_MS = 1500;
const TIMEOUT_MS = 20000;

/**
 * Runs a Splice GraphQL request through the hidden splice.com helper webview
 * (see `splice-helper` in the Rust backend), which fetches from the splice.com
 * origin so it clears Cloudflare Bot Management and Splice's CORS. Communication
 * is a one-shot event round-trip correlated by a request id.
 */
export function spliceSearch(body: string): Promise<string> {
  if (!IN_TAURI) {
    return Promise.resolve(mockSearch(body));
  }

  const id = crypto.randomUUID();

  return new Promise<string>((resolve, reject) => {
    let unlisten: (() => void) | null = null;

    // Re-emit periodically: the helper webview may not have registered its
    // listener yet (it's still loading splice.com / clearing Cloudflare), and
    // Tauri drops events that have no listener rather than queuing them.
    const reEmit = setInterval(() => { emit("splice-search", { id, body }); }, RETRY_INTERVAL_MS);

    const settle = () => { clearInterval(reEmit); clearTimeout(timer); unlisten?.(); };

    const timer = setTimeout(() => {
      settle();
      reject(new Error("Splice search timed out (the helper webview may still be clearing Cloudflare)."));
    }, TIMEOUT_MS);

    listen<{ id: string, ok: boolean, body?: string, error?: string }>("splice-result", ev => {
      if (ev.payload.id !== id) return;

      settle();

      if (ev.payload.ok && ev.payload.body != null) {
        resolve(ev.payload.body);
      } else {
        reject(new Error(ev.payload.error ?? "Splice search failed"));
      }
    }).then(fn => {
      unlisten = fn;
      emit("splice-search", { id, body });
    });
  });
}
