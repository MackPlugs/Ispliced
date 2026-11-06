// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod files;
mod keydet;
mod updater;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// Splice's GraphQL endpoint sits behind Cloudflare Bot Management, which rejects
// any client whose TLS/HTTP2 fingerprint isn't a real browser (Tauri's built-in
// HTTP client included). The only thing Cloudflare reliably accepts is an actual
// browser, and a browser fetch also needs to run from an origin Splice's CORS
// allows -- which is splice.com itself.
//
// So we spawn a hidden webview pointed at splice.com. Once it has passed
// Cloudflare's browser check, it can `fetch()` the GraphQL endpoint same-site,
// and it relays requests/responses to and from the main window over Tauri events.
// See `capabilities/splice-helper.json` for the (event-only) permissions this
// remote webview is granted, and `splice-helper.js` for the injected script.
const SPLICE_HELPER_LABEL: &str = "splice-helper";
const SPLICE_HELPER_URL: &str = "https://splice.com/sounds/search/samples";
const SPLICE_HELPER_INIT: &str = include_str!("splice-helper.js");

fn main() {
    // WebKitGTK's DMA-BUF renderer fails on many Linux GPU setups (notably NVIDIA
    // and some Wayland compositors), leaving the window completely blank. Fall
    // back to the older renderer unless the user has explicitly chosen otherwise.
    // This must happen before any threads are spawned (set_var isn't thread-safe).
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .on_window_event(|window, event| {
            // The hidden search webview must not keep the process alive after
            // the user closes the main application window.
            if window.label() == "main"
                && matches!(event, tauri::WindowEvent::CloseRequested { .. })
            {
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
            // Create this before the frontend starts. The config loader and
            // writer can then safely access config.json through the fs plugin.
            std::fs::create_dir_all(app.path().app_config_dir()?)?;

            let helper_url = SPLICE_HELPER_URL
                .parse()
                .map_err(|e| format!("invalid splice helper URL: {e}"))?;

            WebviewWindowBuilder::new(app, SPLICE_HELPER_LABEL, WebviewUrl::External(helper_url))
                .title("splice-helper")
                .visible(false)
                .skip_taskbar(true)
                .initialization_script(SPLICE_HELPER_INIT)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            files::write_sample_file,
            files::file_exists,
            files::dir_exists,
            files::create_placeholder_file,
            keydet::plan_loop_labels,
            keydet::apply_loop_labels,
            updater::fetch_releases,
            updater::install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
