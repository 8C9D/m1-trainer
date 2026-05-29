import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import { getClassSummary } from "./questions.server";
import { LICENCE_CLASSES, type LicenceClass } from "./questions";

// A minimal question that `parseQuestion` accepts (correctAnswer matches an
// option text). The contents do not matter here — only how many there are.
const validRaw = {
  testName: "x-1",
  questionNumber: 1,
  question: "Q?",
  questionImageUrl: null,
  answerOptions: [
    { index: "1", text: "A" },
    { index: "2", text: "B" },
  ],
  correctAnswer: "A",
  explanation: "",
};

const fakeClass: LicenceClass = {
  key: "x",
  label: "X Class",
  dataFile: "/data/x-all.json",
  bankKey: "x-missed",
  marathonId: "x-all",
  bankId: "x-bank",
  tests: [
    { id: "x-1", label: "One", dataFile: "/data/x-1/questions.json" },
    { id: "x-2", label: "Two", dataFile: "/data/x-2/questions.json" },
  ],
};

describe("getClassSummary (mocked filesystem)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Map a fragment of each test's dataFile path to the JSON its file should
  // contain, so we control the counts without touching the real public data.
  function mockFiles(files: Record<string, unknown>) {
    vi.spyOn(fs, "readFileSync").mockImplementation((file) => {
      const target = String(file);
      const key = Object.keys(files).find((k) => target.includes(k));
      if (key === undefined) throw new Error(`unexpected readFileSync: ${target}`);
      return JSON.stringify(files[key]);
    });
  }

  it("sums counts across the class and reports per-test id/label/count", () => {
    mockFiles({
      "x-1/questions.json": [validRaw, validRaw], // 2
      "x-2/questions.json": [validRaw, validRaw, validRaw], // 3
    });

    const summary = getClassSummary(fakeClass);

    expect(summary.tests).toEqual([
      { id: "x-1", label: "One", count: 2 },
      { id: "x-2", label: "Two", count: 3 },
    ]);
    expect(summary.totalQuestions).toBe(5);
  });

  it("counts an empty data file as zero and still sums the rest", () => {
    mockFiles({
      "x-1/questions.json": [],
      "x-2/questions.json": [validRaw],
    });

    const summary = getClassSummary(fakeClass);

    expect(summary.tests[0].count).toBe(0);
    expect(summary.totalQuestions).toBe(1);
  });

  it("returns an empty summary and reads nothing for a class with no tests", () => {
    const spy = vi.spyOn(fs, "readFileSync");

    const summary = getClassSummary({ ...fakeClass, tests: [] });

    expect(summary).toEqual({ tests: [], totalQuestions: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("surfaces a parse error that names the offending data file", () => {
    mockFiles({
      "x-1/questions.json": [validRaw],
      "x-2/questions.json": { not: "an array" }, // not a question array
    });

    expect(() => getClassSummary(fakeClass)).toThrow("/data/x-2/questions.json");
  });
});

describe("getClassSummary (real public/data)", () => {
  // Smoke test against the committed data files. Asserts invariants rather than
  // exact counts so it survives data updates while still catching a missing or
  // unparseable file, broken summing, or a metadata/summary mismatch.
  for (const cls of LICENCE_CLASSES) {
    it(`computes a consistent summary for "${cls.key}" from the real data files`, () => {
      const summary = getClassSummary(cls);

      expect(summary.tests).toHaveLength(cls.tests.length);
      summary.tests.forEach((test, i) => {
        expect(test.id).toBe(cls.tests[i].id);
        expect(test.label).toBe(cls.tests[i].label);
        expect(Number.isInteger(test.count)).toBe(true);
        expect(test.count).toBeGreaterThan(0);
      });

      const sum = summary.tests.reduce((acc, test) => acc + test.count, 0);
      expect(summary.totalQuestions).toBe(sum);
    });
  }
});
