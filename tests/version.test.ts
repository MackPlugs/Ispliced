import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const packageJson = readJson("../package.json");
const tauriConfig = readJson("../src-tauri/tauri.conf.json");
const cargoToml = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
const cargoLock = readFileSync(new URL("../src-tauri/Cargo.lock", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml)?.[1];
const lockedVersion = /name\s*=\s*"ispliced"\s*\nversion\s*=\s*"([^"]+)"/.exec(cargoLock)?.[1];

describe("app version", () => {
  it("is one semantic version across every manifest", () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(cargoVersion).toBe(packageJson.version);
    expect(lockedVersion).toBe(packageJson.version);
  });

  it("is what the frontend displays by default", () => {
    expect(viteConfig).toContain("package.json");
    expect(viteConfig).toContain("__APP_VERSION__");
  });
});
