import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TestResults } from "./TestResults";

describe("TestResults", () => {
  it("shows the score line", () => {
    render(<TestResults score={32} total={40} isBank={false} onRestart={vi.fn()} />);
    expect(screen.getByText(/32 \/ 40 correct/i)).toBeTruthy();
  });

  it("shows PASS at exactly 80%", () => {
    render(<TestResults score={32} total={40} isBank={false} onRestart={vi.fn()} />);
    expect(screen.getByText(/80% PASS/)).toBeTruthy();
  });

  it("shows FAIL below 80%", () => {
    render(<TestResults score={20} total={40} isBank={false} onRestart={vi.fn()} />);
    expect(screen.getByText(/50% FAIL/)).toBeTruthy();
  });

  it("shows the passing-score note when not in bank mode", () => {
    render(<TestResults score={32} total={40} isBank={false} onRestart={vi.fn()} />);
    expect(screen.getByText(/Passing score: 80%/i)).toBeTruthy();
  });

  it("shows 'Review Complete' instead of a percentage in bank mode", () => {
    render(<TestResults score={3} total={5} isBank={true} onRestart={vi.fn()} />);
    expect(screen.getByText(/Review Complete/i)).toBeTruthy();
    expect(screen.queryByText(/PASS|FAIL|Passing score/)).toBeNull();
  });

  it("calls onRestart when the Restart button is clicked", () => {
    const onRestart = vi.fn();
    render(<TestResults score={1} total={1} isBank={false} onRestart={onRestart} />);
    fireEvent.click(screen.getByRole("button", { name: /restart/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("renders an 'All tests' link to /", () => {
    render(<TestResults score={1} total={1} isBank={false} onRestart={vi.fn()} />);
    const link = screen.getByRole("link", { name: /all tests/i });
    expect(link.getAttribute("href")).toBe("/");
  });
});
