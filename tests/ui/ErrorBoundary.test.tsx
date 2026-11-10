import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../../src/ui/components/ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders its children while nothing throws", () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a recoverable fallback instead of a blank window", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByText("Ispliced hit a problem")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Ispliced" })).toBeInTheDocument();
  });

  it("reloads the window when asked", async () => {
    const onReload = vi.fn();
    render(<ErrorBoundary onReload={onReload}><Boom /></ErrorBoundary>);

    await userEvent.click(screen.getByRole("button", { name: "Reload Ispliced" }));

    expect(onReload).toHaveBeenCalledOnce();
  });
});
