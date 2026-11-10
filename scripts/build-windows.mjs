import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseRoot = path.join(root, "release");
export const target = "x86_64-pc-windows-msvc";

export function buildCommand(visualStudio, exeOnly = false) {
  // cmd expands percent signs even within quotes; reject ambiguous installation paths.
  if (/["%\r\n]/.test(visualStudio)) throw new Error("Unsupported Visual Studio installation path.");
  const vcvars = path.win32.join(visualStudio, "VC", "Auxiliary", "Build", "vcvarsall.bat");
  const bundle = exeOnly ? "--no-bundle" : "--bundles nsis";
  return `call "${vcvars}" x64 && yarn install --frozen-lockfile --non-interactive && yarn tauri build --ci --target ${target} ${bundle}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, ...options });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status ?? "unknown"}).`);
  return result.stdout?.trim();
}

export function pickInstallers(files, version) {
  return files.filter(file => file.endsWith("-setup.exe") && file.includes(`_${version}_`));
}

function installerPaths(release, version) {
  const directory = path.join(release, "bundle", "nsis");
  if (!existsSync(directory)) return [];
  return pickInstallers(readdirSync(directory), version)
    .map(file => path.join(directory, file));
}

/** Replaces release/<folder> with copies of the given artifacts. */
function publish(folder, sources) {
  const directory = path.join(releaseRoot, folder);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  return sources.map(source => {
    const destination = path.join(directory, path.basename(source));
    copyFileSync(source, destination);
    return destination;
  });
}

function packageVersion() {
  return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
}

/** package.json is the source of truth; abort if another manifest drifted. */
export function verifyVersions() {
  const expected = packageVersion();
  const tauriVersion = JSON.parse(readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8")).version;
  const cargoVersion = /^version\s*=\s*"([^"]+)"/m
    .exec(readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8"))?.[1];

  if (tauriVersion !== expected || cargoVersion !== expected) {
    throw new Error(
      `Version mismatch: package.json ${expected}, tauri.conf.json ${tauriVersion}, Cargo.toml ${cargoVersion}. `
      + "Bump every manifest to the current version before building.",
    );
  }
}

function releaseNotes(version) {
  return [
    `Portable Windows build and NSIS installer for Ispliced ${version}.`,
    "",
    "The portable exe needs the Microsoft Edge WebView2 runtime; the installer sets it up automatically.",
  ].join("\n");
}

/** Creates or refreshes the GitHub release for this version and uploads both artifacts. */
function publishRelease(version, portable, installers) {
  if (spawnSync("gh", ["auth", "status"], { cwd: root, stdio: "ignore" }).status !== 0) {
    console.warn("Skipping GitHub release: gh is not installed or not authenticated.");
    return;
  }

  const tag = `v${version}`;
  const upload = path.join(tmpdir(), `Ispliced_${version}_x64-portable.exe`);
  copyFileSync(portable, upload);

  const exists = spawnSync("gh", ["release", "view", tag], { cwd: root, stdio: "ignore" }).status === 0;
  const assets = [upload, ...installers];
  const args = exists
    ? ["release", "upload", tag, ...assets, "--clobber"]
    : ["release", "create", tag, ...assets, "--title", `Ispliced ${version}`, "--notes", releaseNotes(version)];

  try {
    run("gh", args, { stdio: "inherit" });
    console.log(`GitHub release: ${tag}`);
  } finally {
    rmSync(upload, { force: true });
  }
}

export function main(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log("Windows x64 / Visual Studio 2026 builds:\n  yarn build:windows  Application exe + NSIS setup.exe, published to GitHub\n  yarn build:exe      Application exe only (no release)\nArtifacts are copied to release/exe and release/installer.\nSee README.md for prerequisites and output paths.");
    return;
  }
  if (args.some(arg => arg !== "--exe-only")) throw new Error("Unknown option. Use --exe-only or --help.");
  if (process.platform !== "win32") throw new Error("Run this build on Windows with Visual Studio 2026, or use the Windows executable GitHub Actions workflow.");
  verifyVersions();

  const programFiles = process.env["ProgramFiles(x86)"] || process.env.ProgramFiles;
  const vswhere = programFiles && path.join(programFiles, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!vswhere || !existsSync(vswhere)) throw new Error("Visual Studio Installer was not found. Install Visual Studio 2026 with Desktop development with C++.");
  const visualStudio = run(vswhere, ["-latest", "-products", "*", "-version", "[18.0,19.0)",
    "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"], { encoding: "utf8" });
  if (!visualStudio) throw new Error("Visual Studio 2026 C++ tools were not found. In Visual Studio Installer, select Desktop development with C++ and the Windows SDK.");
  if (!existsSync(path.join(visualStudio, "VC", "Auxiliary", "Build", "vcvarsall.bat"))) throw new Error("Visual Studio C++ environment script is missing. Repair the C++ workload in Visual Studio Installer.");

  try {
    run("rustup", ["run", "stable-x86_64-pc-windows-msvc", "rustc", "--version"], { stdio: "inherit" });
  } catch {
    throw new Error("Install or update Rust MSVC first: rustup toolchain install stable-x86_64-pc-windows-msvc --profile minimal");
  }
  const exeOnly = args.includes("--exe-only");
  const version = packageVersion();
  console.log(`Using Visual Studio 2026: ${visualStudio}`);
  run("cmd.exe", ["/d", "/s", "/c", buildCommand(visualStudio, exeOnly)], {
    windowsVerbatimArguments: true,
    stdio: "inherit",
    env: { ...process.env, RUSTUP_TOOLCHAIN: "stable-x86_64-pc-windows-msvc",
      CARGO_TARGET_DIR: path.join(root, "src-tauri", "target") },
  });
  const release = path.join(root, "src-tauri", "target", target, "release");
  const exe = path.join(release, "ispliced.exe");
  if (!existsSync(exe)) throw new Error(`Build finished but the application executable was not found: ${exe}`);

  const installers = exeOnly ? [] : installerPaths(release, version);
  if (!exeOnly && !installers.length) {
    throw new Error(`No Windows setup executable was produced in ${path.join(release, "bundle", "nsis")}`);
  }

  const portable = publish("exe", [exe])[0];
  console.log(`Portable exe: ${portable}`);

  if (!exeOnly) {
    const publishedInstallers = publish("installer", installers);
    for (const installer of publishedInstallers) console.log(`Installer: ${installer}`);
    publishRelease(version, portable, publishedInstallers);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
