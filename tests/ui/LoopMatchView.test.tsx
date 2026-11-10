import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ analyzeLocalLoop: vi.fn() }));
const dialog = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("../../src/native", () => ({
  IN_TAURI: true,
  analyzeLocalLoop: native.analyzeLocalLoop,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: dialog.open }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));

import LoopMatchView from "../../src/ui/components/LoopMatchView";

const analysis = {
  path: "C:/loops/kick.wav",
  name: "kick.wav",
  key: "Cmaj",
  bpm: 128,
  durationMs: 2000,
};

describe("LoopMatchView", () => {
  beforeEach(() => {
    native.analyzeLocalLoop.mockReset();
    dialog.open.mockReset();
  });

  it("analyses a chosen file and hands the match to the browser", async () => {
    dialog.open.mockResolvedValue("C:/loops/kick.wav");
    native.analyzeLocalLoop.mockResolvedValue(analysis);
    const onMatch = vi.fn();

    render(<LoopMatchView onMatch={onMatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Drop or choose a WAV loop to catalogue match" }));

    expect(dialog.open).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: "WAV audio", extensions: ["wav"] }],
    });
    expect(await screen.findByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByLabelText("Detected BPM")).toHaveValue(128);

    await userEvent.click(screen.getByRole("button", { name: "Find matching samples" }));

    expect(onMatch).toHaveBeenCalledWith({ bpm: 128, key: "Cmaj", tolerance: "near" });
  });

  it("reports an analysis failure", async () => {
    dialog.open.mockResolvedValue("C:/loops/broken.wav");
    native.analyzeLocalLoop.mockRejectedValue("cannot analyse broken.wav");

    render(<LoopMatchView onMatch={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Drop or choose a WAV loop to catalogue match" }));

    expect(await screen.findByText("cannot analyse broken.wav")).toBeInTheDocument();
  });

  it("refuses a format local analysis cannot read", async () => {
    dialog.open.mockResolvedValue("C:/loops/kick.aiff");

    render(<LoopMatchView onMatch={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Drop or choose a WAV loop to catalogue match" }));

    expect(await screen.findByText(/supports WAV files/)).toBeInTheDocument();
    expect(screen.getByText(/kick\.aiff/)).toBeInTheDocument();
    expect(native.analyzeLocalLoop).not.toHaveBeenCalled();
  });
});
