import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useParams } from "next/navigation";
import {
  serializeBankStorage,
  BANK_STORAGE_VERSION,
  type Question,
} from "@/lib/questions";
import TestPage from "./page";

// The route reads its id from useParams; everything else (classify, load,
// prepare, score, bank writes) is exercised for real. Bank mode is driven via
// seeded localStorage and the fetch paths via a stubbed fetch, so the only
// doubled boundaries are the route param and the network.
vi.mock("next/navigation", () => ({ useParams: vi.fn() }));

function setTestId(testId: string) {
  vi.mocked(useParams).mockReturnValue({ testId });
}

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

function mockFetchResolving(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("TestPage / TestRun state machine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useParams).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the empty-bank message when the missed-question bank is empty", async () => {
    setTestId("bank"); // M1 missed-questions bank
    render(<TestPage />);

    expect(await screen.findByText("No missed questions yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /all tests/i }).getAttribute("href")).toBe("/");
  });

  it("shows an error message when loading questions fails", async () => {
    setTestId("m1-practice-test-1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    render(<TestPage />);

    expect(
      await screen.findByText("Could not load questions. Please try again later."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /all tests/i }).getAttribute("href")).toBe("/");
  });

  it("renders the first question and the progress counter for a fetched test", async () => {
    setTestId("all"); // M1 marathon → full-corpus file
    const fetchMock = mockFetchResolving([
      makeQuestion({ questionNumber: 1 }),
      makeQuestion({ questionNumber: 2, question: "Second question?" }),
    ]);
    render(<TestPage />);

    expect(await screen.findByText(/1 \/ 2/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /banana/i })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/data/all-questions.json");
  });

  it("scores a correct answer through to results and clears it from the bank", async () => {
    localStorage.setItem("g1-missed", serializeBankStorage([makeQuestion()]));
    setTestId("g1-bank");
    render(<TestPage />);

    // The single bank question loads (no fetch); answer it correctly and finish.
    fireEvent.click(await screen.findByRole("button", { name: /banana/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    expect(await screen.findByText("Review Complete")).toBeTruthy();
    expect(screen.getByText(/1 \/ 1 correct/)).toBeTruthy();

    // Answered correctly → removed from the missed-question bank.
    expect(JSON.parse(localStorage.getItem("g1-missed")!)).toEqual({
      version: BANK_STORAGE_VERSION,
      questions: [],
    });
  });
});
