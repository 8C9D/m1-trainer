import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  deriveCorrectAnswerIndex,
  parseQuestion,
  parseQuestionsArray,
  prepareTestQuestions,
  getBankQuestions,
  updateBank,
  getQuestionsForClass,
  getQuestionsForPracticeTest,
  BANK_STORAGE_VERSION,
  LICENCE_CLASSES,
  type Question,
} from "./questions";

const validRaw = {
  testName: "g1-practice-test-1",
  questionNumber: 1,
  question: "What does this road sign mean?",
  questionImageUrl: null,
  answerOptions: [
    { index: "1", text: "Snowmobiles may not use this road." },
    { index: "2", text: "Snowmobiles may use this road." },
    { index: "3", text: "Only snowmobiles may park here." },
    { index: "4", text: "There is a snowmobile repair shop ahead." },
  ],
  correctAnswer: "Snowmobiles may use this road.",
  explanation: "A green circle indicates permission.",
};

describe("deriveCorrectAnswerIndex", () => {
  const options = [
    { index: "1", text: "A" },
    { index: "2", text: "B" },
    { index: "3", text: "C" },
  ];

  it("returns null when correctAnswer is null", () => {
    expect(deriveCorrectAnswerIndex(options, null)).toBeNull();
  });

  it("returns the matching option's stable index", () => {
    expect(deriveCorrectAnswerIndex(options, "B")).toBe("2");
  });

  it("returns null when no option text matches", () => {
    expect(deriveCorrectAnswerIndex(options, "missing")).toBeNull();
  });
});

describe("parseQuestion", () => {
  it("accepts a valid question and derives correctAnswerIndex", () => {
    const q = parseQuestion(validRaw);
    expect(q.testName).toBe("g1-practice-test-1");
    expect(q.questionNumber).toBe(1);
    expect(q.answerOptions).toHaveLength(4);
    expect(q.correctAnswerIndex).toBe("2");
  });

  it("allows correctAnswer to be null and yields a null derived index", () => {
    const q = parseQuestion({ ...validRaw, correctAnswer: null });
    expect(q.correctAnswer).toBeNull();
    expect(q.correctAnswerIndex).toBeNull();
  });

  it("allows questionImageUrl to be a string", () => {
    const q = parseQuestion({ ...validRaw, questionImageUrl: "https://example.com/x.jpg" });
    expect(q.questionImageUrl).toBe("https://example.com/x.jpg");
  });

  it("rejects a missing testName", () => {
    expect(() => parseQuestion({ ...validRaw, testName: 42 })).toThrow(/testName/);
  });

  it("rejects a non-numeric questionNumber", () => {
    expect(() => parseQuestion({ ...validRaw, questionNumber: "1" })).toThrow(/questionNumber/);
  });

  it("rejects questionImageUrl that is neither string nor null", () => {
    expect(() => parseQuestion({ ...validRaw, questionImageUrl: 0 })).toThrow(/questionImageUrl/);
  });

  it("rejects answerOptions that is not an array", () => {
    expect(() => parseQuestion({ ...validRaw, answerOptions: {} })).toThrow(/answerOptions/);
  });

  it("rejects an answer option whose index is not a string", () => {
    const bad = {
      ...validRaw,
      answerOptions: [
        { index: 1, text: "A" },
        { index: "2", text: "B" },
        { index: "3", text: "C" },
        { index: "4", text: "D" },
      ],
    };
    expect(() => parseQuestion(bad)).toThrow(/index must be a string/);
  });

  it("rejects an answer option whose text is not a string", () => {
    const bad = {
      ...validRaw,
      answerOptions: [
        { index: "1", text: "A" },
        { index: "2", text: 7 },
        { index: "3", text: "C" },
        { index: "4", text: "D" },
      ],
    };
    expect(() => parseQuestion(bad)).toThrow(/text must be a string/);
  });

  it("rejects a missing explanation", () => {
    expect(() => parseQuestion({ ...validRaw, explanation: undefined })).toThrow(/explanation/);
  });

  it("rejects a correctAnswer that does not match any answer option text", () => {
    const bad = { ...validRaw, correctAnswer: "definitely not in the list" };
    expect(() => parseQuestion(bad)).toThrow(/does not match any answerOption/);
  });
});

describe("parseQuestionsArray", () => {
  it("returns parsed questions for a valid array", () => {
    const result = parseQuestionsArray([validRaw, { ...validRaw, questionNumber: 2 }], "src");
    expect(result).toHaveLength(2);
    expect(result[0].questionNumber).toBe(1);
    expect(result[1].questionNumber).toBe(2);
  });

  it("returns [] for an empty array", () => {
    expect(parseQuestionsArray([], "src")).toEqual([]);
  });

  it("throws with the sourceLabel when raw is not an array", () => {
    expect(() => parseQuestionsArray({ not: "an array" }, "/data/foo.json")).toThrow(
      /^\/data\/foo\.json: expected an array of questions at the top level$/,
    );
  });

  it("includes the failing index and sourceLabel in the error message", () => {
    const bad = { ...validRaw, testName: 42 };
    expect(() => parseQuestionsArray([validRaw, validRaw, bad], "/data/foo.json")).toThrow(
      /^\/data\/foo\.json\[2\]: .*testName/,
    );
  });
});

describe("prepareTestQuestions", () => {
  const makeQuestion = (n: number): Question => ({
    testName: "g1-practice-test-1",
    questionNumber: n,
    question: `Q${n}`,
    questionImageUrl: null,
    answerOptions: [
      { index: "1", text: "A" },
      { index: "2", text: "B" },
      { index: "3", text: "C" },
      { index: "4", text: "D" },
    ],
    correctAnswer: "B",
    correctAnswerIndex: "2",
    explanation: "",
  });

  it("preserves the set of questions", () => {
    const input = [1, 2, 3, 4, 5].map(makeQuestion);
    const out = prepareTestQuestions(input);
    expect(out).toHaveLength(input.length);
    expect(out.map((q) => q.questionNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves each question's set of answer options", () => {
    const out = prepareTestQuestions([makeQuestion(1)]);
    expect(out[0].answerOptions.map((o) => o.index).sort()).toEqual(["1", "2", "3", "4"]);
    expect(out[0].answerOptions.map((o) => o.text).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("does not mutate the input array or its questions' answer options", () => {
    const input = [makeQuestion(1), makeQuestion(2)];
    const snapshot = JSON.parse(JSON.stringify(input));
    prepareTestQuestions(input);
    expect(input).toEqual(snapshot);
  });

  it("returns [] for an empty input", () => {
    expect(prepareTestQuestions([])).toEqual([]);
  });
});

describe("getBankQuestions", () => {
  const bankKey = "test-bank";

  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty array when no entries exist", () => {
    expect(getBankQuestions(bankKey)).toEqual([]);
  });

  it("normalizes older entries lacking correctAnswerIndex by deriving it on read", () => {
    const legacyEntry = {
      testName: "g1-practice-test-1",
      questionNumber: 5,
      question: "Q?",
      questionImageUrl: null,
      answerOptions: [
        { index: "1", text: "Yes" },
        { index: "2", text: "No" },
      ],
      correctAnswer: "No",
      explanation: "Because.",
    };
    localStorage.setItem(bankKey, JSON.stringify([legacyEntry]));
    const result = getBankQuestions(bankKey);
    expect(result).toHaveLength(1);
    expect(result[0].correctAnswerIndex).toBe("2");
  });

  it("preserves a present correctAnswerIndex without re-derivation", () => {
    const entry: Question = {
      testName: "g1-practice-test-1",
      questionNumber: 6,
      question: "Q?",
      questionImageUrl: null,
      answerOptions: [
        { index: "1", text: "A" },
        { index: "2", text: "B" },
      ],
      correctAnswer: "A",
      correctAnswerIndex: "1",
      explanation: "",
    };
    localStorage.setItem(bankKey, JSON.stringify([entry]));
    expect(getBankQuestions(bankKey)[0].correctAnswerIndex).toBe("1");
  });

  it("returns an empty array when localStorage contains invalid JSON", () => {
    localStorage.setItem(bankKey, "not-json");
    expect(getBankQuestions(bankKey)).toEqual([]);
  });

  it("reads the new versioned envelope", () => {
    const entry: Question = {
      testName: "g1-practice-test-1",
      questionNumber: 7,
      question: "Q?",
      questionImageUrl: null,
      answerOptions: [
        { index: "1", text: "A" },
        { index: "2", text: "B" },
      ],
      correctAnswer: "B",
      correctAnswerIndex: "2",
      explanation: "",
    };
    localStorage.setItem(
      bankKey,
      JSON.stringify({ version: BANK_STORAGE_VERSION, questions: [entry] }),
    );
    const result = getBankQuestions(bankKey);
    expect(result).toHaveLength(1);
    expect(result[0].questionNumber).toBe(7);
    expect(result[0].correctAnswerIndex).toBe("2");
  });

  it("derives correctAnswerIndex for versioned entries that lack it", () => {
    const legacyShapeInsideEnvelope = {
      testName: "g1-practice-test-1",
      questionNumber: 8,
      question: "Q?",
      questionImageUrl: null,
      answerOptions: [
        { index: "1", text: "Yes" },
        { index: "2", text: "No" },
      ],
      correctAnswer: "No",
      explanation: "",
    };
    localStorage.setItem(
      bankKey,
      JSON.stringify({ version: BANK_STORAGE_VERSION, questions: [legacyShapeInsideEnvelope] }),
    );
    expect(getBankQuestions(bankKey)[0].correctAnswerIndex).toBe("2");
  });

  it("returns [] for an unsupported version", () => {
    localStorage.setItem(
      bankKey,
      JSON.stringify({ version: 999, questions: [{ anything: true }] }),
    );
    expect(getBankQuestions(bankKey)).toEqual([]);
  });

  it("returns [] for a non-array, non-envelope object", () => {
    localStorage.setItem(bankKey, JSON.stringify({ foo: "bar" }));
    expect(getBankQuestions(bankKey)).toEqual([]);
  });
});

describe("updateBank", () => {
  const bankKey = "test-bank";

  const baseQuestion: Question = {
    testName: "g1-practice-test-1",
    questionNumber: 1,
    question: "Q1?",
    questionImageUrl: null,
    answerOptions: [
      { index: "1", text: "A" },
      { index: "2", text: "B" },
    ],
    correctAnswer: "A",
    correctAnswerIndex: "1",
    explanation: "",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("writes the new versioned envelope when adding an incorrect answer", () => {
    updateBank(baseQuestion, false, bankKey);
    const stored = JSON.parse(localStorage.getItem(bankKey)!);
    expect(stored).toEqual({
      version: BANK_STORAGE_VERSION,
      questions: [baseQuestion],
    });
  });

  it("dedupes when the same question is answered incorrectly twice", () => {
    updateBank(baseQuestion, false, bankKey);
    updateBank(baseQuestion, false, bankKey);
    const stored = JSON.parse(localStorage.getItem(bankKey)!);
    expect(stored.questions).toHaveLength(1);
  });

  it("removes a question from the bank when answered correctly", () => {
    updateBank(baseQuestion, false, bankKey);
    updateBank(baseQuestion, true, bankKey);
    const stored = JSON.parse(localStorage.getItem(bankKey)!);
    expect(stored).toEqual({ version: BANK_STORAGE_VERSION, questions: [] });
  });

  it("migrates legacy raw-array storage to the versioned envelope on next write", () => {
    const legacyEntry = {
      testName: "g1-practice-test-1",
      questionNumber: 2,
      question: "Q2?",
      questionImageUrl: null,
      answerOptions: [
        { index: "1", text: "A" },
        { index: "2", text: "B" },
      ],
      correctAnswer: "B",
      explanation: "",
    };
    localStorage.setItem(bankKey, JSON.stringify([legacyEntry]));
    updateBank(baseQuestion, false, bankKey);
    const stored = JSON.parse(localStorage.getItem(bankKey)!);
    expect(stored.version).toBe(BANK_STORAGE_VERSION);
    expect(stored.questions).toHaveLength(2);
    expect(stored.questions[0].correctAnswerIndex).toBe("2");
    expect(stored.questions[1].questionNumber).toBe(1);
  });
});

describe("data-file resolution", () => {
  const m1 = LICENCE_CLASSES.find((c) => c.key === "m1")!;
  const g1 = LICENCE_CLASSES.find((c) => c.key === "g1")!;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [validRaw],
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the per-test JSON file for an individual practice test", async () => {
    await getQuestionsForPracticeTest(g1, "g1-practice-test-1");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/data/g1-practice-test-1/questions.json");
  });

  it("uses each M1 practice test's own file", async () => {
    await getQuestionsForPracticeTest(m1, "m1-practice-test-4");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/data/m1-practice-test-4/questions.json");
  });

  it("does not fetch and returns [] for an unknown test id", async () => {
    const result = await getQuestionsForPracticeTest(g1, "g1-practice-test-bogus");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marathon loading still uses the full-corpus file", async () => {
    await getQuestionsForClass(m1);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/data/all-questions.json");
  });

  it("marathon loading for G1 still uses the full G1 corpus file", async () => {
    await getQuestionsForClass(g1);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/data/g1-all-questions.json");
  });
});
