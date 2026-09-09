/* VERRAA — unit tests for ui.tsx components and hooks */

// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  Spinner,
  Divider,
  Card,
  Badge,
  Avatar,
  Toggle,
  MoodDots,
  MoodPicker,
  EmptyState,
  Skeleton,
  FormError,
  useCountUp,
} from "./components/ui";

afterEach(() => cleanup());

describe("Spinner", () => {
  it("renders a spinner", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
  it("renders with custom size", () => {
    const { container } = render(<Spinner className="h-8 w-8" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
  });
});

describe("Divider", () => {
  it("renders a divider", () => {
    const { container } = render(<Divider />);
    expect(container.querySelector("[class*='border-t']")).toBeTruthy();
  });
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card><span>Content</span></Card>);
    expect(screen.getByText("Content")).toBeTruthy();
  });
});

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeTruthy();
  });
});

describe("Avatar", () => {
  it("renders initials from name", () => {
    render(<Avatar name="Ahmed Samy" />);
    expect(screen.getByText("AS")).toBeTruthy();
  });
  it("renders with photo", () => {
    const { container } = render(<Avatar name="Test" photo="data:image/png;base64,abc" />);
    expect(container.querySelector("img")).toBeTruthy();
  });
});

describe("Toggle", () => {
  it("renders with label", () => {
    render(<Toggle checked={false} onChange={() => {}} label="Dark mode" />);
    expect(screen.getByText("Dark mode")).toBeTruthy();
  });
  it("calls onChange when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Test toggle" />);
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("MoodDots", () => {
  it("renders 5 mood dots", () => {
    const { container } = render(<MoodDots mood={3} />);
    const dots = container.querySelectorAll("span[class*='rounded-full']");
    expect(dots.length).toBe(5);
  });
});

describe("MoodPicker", () => {
  it("renders 5 mood radio buttons", () => {
    render(<MoodPicker value={3} onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(5);
  });
  it("calls onChange when a mood is clicked", () => {
    const onChange = vi.fn();
    render(<MoodPicker value={2} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[4]);
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe("EmptyState", () => {
  it("renders title and icon", () => {
    render(<EmptyState icon={<span>icon</span>} title="No clients yet" />);
    expect(screen.getByText("No clients yet")).toBeTruthy();
  });
  it("renders sub text", () => {
    render(<EmptyState icon={<span>icon</span>} title="No clients" sub="Add your first client" />);
    expect(screen.getByText("Add your first client")).toBeTruthy();
  });
});

describe("Skeleton", () => {
  it("renders a skeleton element", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("FormError", () => {
  it("returns null when no message", () => {
    const { container } = render(<FormError message={undefined} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders error message", () => {
    render(<FormError message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});

describe("useCountUp", () => {
  it("returns the target value", () => {
    const { result } = renderHook(() => useCountUp(100));
    expect(result.current).toBe(100);
  });
});