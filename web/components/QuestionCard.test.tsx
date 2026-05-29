import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionCard } from "./QuestionCard";
import type { Question } from "@/lib/questions";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    testName: "g1-practice-test-1",
    questionNumber: 1,
    question: "Pick the fruit.",
    questionImageUrl: null,
    answerOptions: [
      { index: "1", text: "Apple" },
      { index: "2", text: "Banana" },
      { index: "3", text: "Cherry" },
      { index: "4", text: "Date" },
    ],
    correctAnswer: "Banana",
    correctAnswerIndex: "2",
    explanation: "Banana is the fruit.",
    ...overrides,
  };
}

describe("QuestionCard", () => {
  it("renders all answer options", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={vi.fn()} />,
    );
    for (const text of ["Apple", "Banana", "Cherry", "Date"]) {
      expect(screen.getByRole("button", { name: new RegExp(text, "i") })).toBeTruthy();
    }
  });

  it("calls onNext(true) when the correct option is selected and Next is clicked", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /banana/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it("calls onNext(false) when an incorrect option is selected and Next is clicked", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /apple/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith(false);
  });

  it("uses stable index — not display position — to determine correctness when answer order is shuffled", () => {
    const onNext = vi.fn();
    const shuffled = makeQuestion({
      answerOptions: [
        { index: "3", text: "Cherry" },
        { index: "2", text: "Banana" },
        { index: "4", text: "Date" },
        { index: "1", text: "Apple" },
      ],
    });
    render(
      <QuestionCard question={shuffled} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /banana/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it("shows the Finish label on the last question", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={5} total={5} onNext={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /banana/i }));
    expect(screen.getByRole("button", { name: /finish/i })).toBeTruthy();
  });

  it("reveals the explanation only after an option is selected", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={vi.fn()} />,
    );
    expect(screen.queryByText("Banana is the fruit.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /banana/i }));
    expect(screen.getByText("Banana is the fruit.")).toBeTruthy();
  });

  it("locks the selection once an answer is chosen, ignoring later clicks", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /apple/i })); // incorrect, locks in
    fireEvent.click(screen.getByRole("button", { name: /banana/i })); // should be ignored
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(false);
  });

  it("shows no ✓/✗ feedback markers before an answer is chosen", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={vi.fn()} />,
    );
    expect(screen.queryByText("✓")).toBeNull();
    expect(screen.queryByText("✗")).toBeNull();
  });

  it("marks the correct option with ✓ and the chosen wrong option with ✗ after answering", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /apple/i })); // wrong; correct is Banana

    expect(screen.getByRole("button", { name: /banana/i }).textContent).toContain("✓");
    expect(screen.getByRole("button", { name: /apple/i }).textContent).toContain("✗");
    const untouched = screen.getByRole("button", { name: /cherry/i }).textContent ?? "";
    expect(untouched).not.toContain("✓");
    expect(untouched).not.toContain("✗");
  });

  it("marks only the correct option with ✓ (and shows no ✗) when answered correctly", () => {
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /banana/i })); // correct

    expect(screen.getByRole("button", { name: /banana/i }).textContent).toContain("✓");
    expect(screen.queryByText("✗")).toBeNull();
  });
});

describe("QuestionCard keyboard navigation", () => {
  it("selects the option at the pressed digit's position", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.keyDown(window, { key: "2" }); // Banana, the correct option
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it("maps the digit to position, so a wrong digit advances with false", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.keyDown(window, { key: "1" }); // Apple, incorrect
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledWith(false);
  });

  it("advances on the space key after an answer is selected", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /banana/i }));
    fireEvent.keyDown(window, { key: " " });
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it("ignores a digit with no matching option and does not advance before answering", () => {
    const onNext = vi.fn();
    render(
      <QuestionCard question={makeQuestion()} questionNumber={1} total={4} onNext={onNext} />,
    );
    fireEvent.keyDown(window, { key: "9" }); // out of range, no selection
    expect(screen.queryByText("Banana is the fruit.")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" }); // nothing selected yet
    expect(onNext).not.toHaveBeenCalled();
  });
});
