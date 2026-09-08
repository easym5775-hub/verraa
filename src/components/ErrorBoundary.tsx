import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { btnSecondary } from "./ui";

interface Props {
  section: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  /** Bumped on every retry so children fully remount (a rejected lazy
      chunk is cached by React — without a fresh mount "Try again" could
      never refetch it). */
  nonce: number;
  /** React component stack — dev only, pinpoints the suspender. */
  stack: string;
}

/**
 * Per-section error boundary — a crash in one view/section
 * never takes down the whole app shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", nonce: 0, stack: "" };

  static getDerivedStateFromError(err: unknown): Partial<State> {
    // NOTE: nonce is intentionally left untouched so consecutive
    // error → retry cycles always produce a fresh remount key.
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    // Visible in devtools / error tracking; never shown raw to the client.
    console.error(`[ErrorBoundary:${this.props.section}] rev=${__APP_REV__}`, err, info.componentStack ?? "");
    if (info.componentStack) this.setState({ stack: info.componentStack });
  }

  reset = () =>
    this.setState((s) => ({ hasError: false, message: "", stack: "", nonce: s.nonce + 1 }));

  render() {
    if (!this.state.hasError) return <Fragment key={this.state.nonce}>{this.props.children}</Fragment>;
    return (
      <div
        role="alert"
        className="rise rounded-[20px] border border-danger-500/25 bg-danger-500/[0.06] p-6 text-center sm:p-8"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-danger-500/25 bg-danger-500/10 text-danger-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="mt-3 text-[15px] font-bold text-mist-100">
          {this.props.section} couldn&apos;t load
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-6 text-mist-400">
          The rest of the app is fine. Try again — if it keeps happening, reload
          the page.
        </p>
        {import.meta.env.DEV && (
          <details className="mx-auto mt-3 max-w-md text-start">
            <summary className="cursor-pointer text-center text-[11px] font-bold text-mist-500 hover:text-mist-300">
              Technical details · rev {__APP_REV__}
            </summary>
            <p className="mt-2 break-words font-mono text-[11px] leading-5 text-mist-500">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-mist-500/80" dir="ltr">
                {this.state.stack}
              </pre>
            )}
          </details>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button className={`${btnSecondary} h-10`} onClick={this.reset}>
            Try again
          </button>
          <button
            className={`${btnSecondary} h-10`}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

/** Convenience wrapper with a stable section name. */
export function SectionErrorBoundary({
  section,
  children,
}: Props) {
  return <ErrorBoundary section={section}>{children}</ErrorBoundary>;
}
