import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LICENCE_CLASSES,
  MARATHON_LABEL,
  BANK_LABEL,
  serializeBankStorage,
  type Question,
} from "@/lib/questions";
import { getClassSummary } from "@/lib/questions.server";
import Home from "./page";

// Home is a synchronous server component; with the `server-only` alias it
// renders under jsdom and reads the real public/data files via getClassSummary.
// Links are matched by their unique `/test/{id}` href (test ids are
// class-prefixed, so labels like "Practice Test 1" are not ambiguous), and the
// displayed counts are pinned to getClassSummary's output rather than to
// hard-coded numbers, so the test survives data updates.

function makeQuestion(n: number): Question {
  return {
    testName: "g1-practice-test-1",
    questionNumber: n,
    question: `Q${n}?`,
    questionImageUrl: null,
    answerOptions: [
      { index: "1", text: "A" },
      { index: "2", text: "B" },
    ],
    correctAnswer: "A",
    correctAnswerIndex: "1",
    explanation: "",
  };
}

describe("Home", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders each licence class with a link per practice test and a marathon link", () => {
    const { container } = render(<Home />);

    for (const cls of LICENCE_CLASSES) {
      const summary = getClassSummary(cls);
      expect(screen.getByText(cls.label)).toBeTruthy();

      for (const test of summary.tests) {
        const link = container.querySelector(`a[href="/test/${test.id}"]`);
        expect(link, `link for ${test.id}`).not.toBeNull();
        expect(link!.textContent).toContain(test.label);
        expect(link!.textContent).toContain(`${test.count} questions`);
      }

      const marathon = container.querySelector(`a[href="/test/${cls.marathonId}"]`);
      expect(marathon, `marathon link for ${cls.key}`).not.toBeNull();
      expect(marathon!.textContent).toContain(MARATHON_LABEL);
      expect(marathon!.textContent).toContain(`${summary.totalQuestions} questions`);
    }
  });

  it("does not render the missed-questions bank link when the bank is empty", () => {
    const { container } = render(<Home />);
    for (const cls of LICENCE_CLASSES) {
      expect(container.querySelector(`a[href="/test/${cls.bankId}"]`)).toBeNull();
    }
  });

  it("renders the missed-questions bank link once the bank is non-empty", () => {
    localStorage.setItem(
      "g1-missed",
      serializeBankStorage([makeQuestion(1), makeQuestion(2)]),
    );

    const { container } = render(<Home />);

    const bankLink = container.querySelector('a[href="/test/g1-bank"]');
    expect(bankLink).not.toBeNull();
    expect(bankLink!.textContent).toContain(BANK_LABEL);
    expect(bankLink!.textContent).toContain("2 questions");
  });
});
