import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import { ToastProvider } from "@heroui/react";

import App from "./ui/App";
import { PlayerProvider } from "./ui/player";
import { loadConfig } from "./config";
import { refreshDarkMode } from "./ui/theming";

import "./ui/styles.css";

window.Buffer = Buffer; // required for node-wav

await loadConfig();

refreshDarkMode();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PlayerProvider>
      <App />
    </PlayerProvider>
    <ToastProvider placement="bottom" />
  </React.StrictMode>,
);
