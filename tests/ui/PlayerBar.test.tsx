import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  player: {
    track: { uuid: "a", name: "kick.wav", pack: "Pack", durationMs: 1000, bpm: 128 },
    playing: false,
    volume: 0.8,
    tempoLock: false,
    targetBpm: 120,
    loop: false,
    alternate: null,
    toggle: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setTempoLock: vi.fn(),
    setTargetBpm: vi.fn(),
    setLoop: vi.fn(),
    swap: vi.fn(),
    isCurrent: () => true,
  },
}));

vi.mock("../../src/ui/player", () => ({
  usePlayer: () => state.player,
  usePlayerProgress: () => 0,
}));

import PlayerBar from "../../src/ui/components/PlayerBar";

describe("PlayerBar next and previous", () => {
  it("disables both arrows when the sample has no neighbours", () => {
    render(<PlayerBar />);

    expect(screen.getByRole("button", { name: "Previous sample" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next sample" })).toBeDisabled();
  });

  it("calls the supplied handlers when arrows are available", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(<PlayerBar onPrevious={onPrevious} onNext={onNext} canPrevious canNext />);

    await userEvent.click(screen.getByRole("button", { name: "Previous sample" }));
    await userEvent.click(screen.getByRole("button", { name: "Next sample" }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows the tempo from the track", () => {
    render(<PlayerBar />);

    expect(screen.getByText(/128 BPM/)).toBeInTheDocument();
  });
});
