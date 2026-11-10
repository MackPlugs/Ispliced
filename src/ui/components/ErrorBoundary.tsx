import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

type State = { error: Error | null };

/** Stops a render error from leaving the window blank. */
export default class ErrorBoundary extends Component<{ children: ReactNode; onReload?: () => void }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ispliced render error:", error, info.componentStack);
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (error == null) return this.props.children;

    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <img src="img/blob-think.png" alt="" className="w-16 select-none" draggable={false} />
        <h1 className="text-xl font-semibold">Ispliced hit a problem</h1>
        <p className="max-w-xl text-sm text-muted">
          Reloading usually clears it. Your settings and downloads are untouched.
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Reload Ispliced
        </button>
        <details className="max-w-2xl text-left text-xs text-muted">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
      </main>
    );
  }
}
