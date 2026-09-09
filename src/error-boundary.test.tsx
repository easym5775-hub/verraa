/* VERRAA — unit tests for ErrorBoundary */

// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBoundary, SectionErrorBoundary } from "./components/ErrorBoundary";

const ErrorComponent = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  afterEach(() => cleanup());

  it("renders children when no error", () => {
    render(
      <ErrorBoundary section="Test">
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("renders error UI when error is thrown", () => {
    render(
      <ErrorBoundary section="Dashboard">
        <ErrorComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Dashboard couldn't load")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("shows the error message in technical details", () => {
    const { container } = render(
      <ErrorBoundary section="Settings">
        <ErrorComponent />
      </ErrorBoundary>
    );
    expect(container.querySelector(".break-words")).toBeTruthy();
  });

  it("has a reload page button", () => {
    render(
      <ErrorBoundary section="Test">
        <ErrorComponent />
      </ErrorBoundary>
    );
    const buttons = screen.getAllByText("Reload page");
    expect(buttons.length).toBe(1);
  });
});

describe("SectionErrorBoundary", () => {
  afterEach(() => cleanup());

  it("renders with a stable section name", () => {
    render(
      <SectionErrorBoundary section="Plans">
        <div>Plan content</div>
      </SectionErrorBoundary>
    );
    expect(screen.getByText("Plan content")).toBeTruthy();
  });
});