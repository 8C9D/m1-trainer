export interface AnswerOption {
  index: string;
  text: string;
}

export interface Question {
  testName: string;
  questionNumber: number;
  question: string;
  questionImageUrl: string | null;
  answerOptions: AnswerOption[];
  correctAnswer: string | null;
  correctAnswerIndex: string | null;
  explanation: string;
}

export interface PracticeTestMeta {
  label: string;
  order: number;
  dataFile: string;
}

export interface LicenceClass {
  key: string;
  label: string;
  dataFile: string;
  bankKey: string;
  marathonId: string;
  bankId: string;
  tests: Record<string, PracticeTestMeta>;
}

export const MARATHON_LABEL = "Marathon";
export const BANK_LABEL = "Missed Questions";

export const LICENCE_CLASSES: LicenceClass[] = [
  {
    key: "m1",
    label: "M1 Motorcycle",
    dataFile: "/data/all-questions.json",
    bankKey: "m1-missed",
    marathonId: "all",
    bankId: "bank",
    tests: {
      "m1-practice-test-1": { label: "Practice Test 1", order: 1, dataFile: "/data/m1-practice-test-1/questions.json" },
      "m1-practice-test-2": { label: "Practice Test 2", order: 2, dataFile: "/data/m1-practice-test-2/questions.json" },
      "m1-practice-test-3": { label: "Practice Test 3", order: 3, dataFile: "/data/m1-practice-test-3/questions.json" },
      "m1-practice-test-4": { label: "Fines & Limits", order: 4, dataFile: "/data/m1-practice-test-4/questions.json" },
      "m1-practice-test-5": { label: "Road Sign Test", order: 5, dataFile: "/data/m1-practice-test-5/questions.json" },
    },
  },
  {
    key: "g1",
    label: "G1 Car",
    dataFile: "/data/g1-all-questions.json",
    bankKey: "g1-missed",
    marathonId: "g1-all",
    bankId: "g1-bank",
    tests: {
      "g1-practice-test-1": { label: "Practice Test 1", order: 1, dataFile: "/data/g1-practice-test-1/questions.json" },
      "g1-practice-test-2": { label: "Practice Test 2", order: 2, dataFile: "/data/g1-practice-test-2/questions.json" },
      "g1-practice-test-3": { label: "Practice Test 3", order: 3, dataFile: "/data/g1-practice-test-3/questions.json" },
    },
  },
];

export function getLicenceClassForTestId(testId: string): LicenceClass | undefined {
  return LICENCE_CLASSES.find(
    (c) => c.marathonId === testId || c.bankId === testId || testId in c.tests,
  );
}

export function isBankTest(testId: string): boolean {
  return LICENCE_CLASSES.some((c) => c.bankId === testId);
}

export function getTestLabel(testId: string): string {
  for (const c of LICENCE_CLASSES) {
    const meta = c.tests[testId];
    if (meta) return meta.label;
    if (c.marathonId === testId) return MARATHON_LABEL;
    if (c.bankId === testId) return BANK_LABEL;
  }
  return testId;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function prepareTestQuestions(base: Question[]): Question[] {
  return shuffle(base).map((q) => ({ ...q, answerOptions: shuffle(q.answerOptions) }));
}

function questionId(q: Question): string {
  return `${q.testName}-${q.questionNumber}`;
}

export function deriveCorrectAnswerIndex(
  answerOptions: AnswerOption[],
  correctAnswer: string | null,
): string | null {
  if (!correctAnswer) return null;
  return answerOptions.find((o) => o.text === correctAnswer)?.index ?? null;
}

function parseAnswerOption(raw: unknown, ctx: string): AnswerOption {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${ctx}: expected an object`);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.index !== "string") throw new Error(`${ctx}.index must be a string`);
  if (typeof o.text !== "string") throw new Error(`${ctx}.text must be a string`);
  return { index: o.index, text: o.text };
}

export function parseQuestion(raw: unknown): Question {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("question is not an object");
  }
  const q = raw as Record<string, unknown>;
  const id = `${typeof q.testName === "string" ? q.testName : "?"}#${
    typeof q.questionNumber === "number" ? q.questionNumber : "?"
  }`;
  if (typeof q.testName !== "string") throw new Error(`${id}: testName must be a string`);
  if (typeof q.questionNumber !== "number") throw new Error(`${id}: questionNumber must be a number`);
  if (typeof q.question !== "string") throw new Error(`${id}: question must be a string`);
  if (q.questionImageUrl !== null && typeof q.questionImageUrl !== "string") {
    throw new Error(`${id}: questionImageUrl must be a string or null`);
  }
  if (!Array.isArray(q.answerOptions)) throw new Error(`${id}: answerOptions must be an array`);
  const answerOptions = q.answerOptions.map((opt, i) =>
    parseAnswerOption(opt, `${id}.answerOptions[${i}]`),
  );
  if (q.correctAnswer !== null && typeof q.correctAnswer !== "string") {
    throw new Error(`${id}: correctAnswer must be a string or null`);
  }
  if (typeof q.explanation !== "string") throw new Error(`${id}: explanation must be a string`);
  const correctAnswer = q.correctAnswer as string | null;
  const correctAnswerIndex = deriveCorrectAnswerIndex(answerOptions, correctAnswer);
  if (correctAnswer !== null && correctAnswerIndex === null) {
    throw new Error(
      `${id}: correctAnswer "${correctAnswer}" does not match any answerOption text`,
    );
  }
  return {
    testName: q.testName,
    questionNumber: q.questionNumber,
    question: q.question,
    questionImageUrl: q.questionImageUrl as string | null,
    answerOptions,
    correctAnswer,
    correctAnswerIndex,
    explanation: q.explanation,
  };
}

export const BANK_STORAGE_VERSION = 1;

export interface BankStorageV1 {
  version: 1;
  questions: Question[];
}

type StoredBankQuestion = Omit<Question, "correctAnswerIndex"> & {
  correctAnswerIndex?: string | null;
};

function normalizeBankQuestion(q: StoredBankQuestion): Question {
  return {
    ...q,
    correctAnswerIndex:
      q.correctAnswerIndex ?? deriveCorrectAnswerIndex(q.answerOptions, q.correctAnswer),
  };
}

export function parseBankStorage(raw: string | null): Question[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed.map((q) => normalizeBankQuestion(q as StoredBankQuestion));
  }
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as { version?: unknown; questions?: unknown };
    if (obj.version === BANK_STORAGE_VERSION && Array.isArray(obj.questions)) {
      return obj.questions.map((q) => normalizeBankQuestion(q as StoredBankQuestion));
    }
  }
  return [];
}

export function serializeBankStorage(questions: Question[]): string {
  const envelope: BankStorageV1 = { version: BANK_STORAGE_VERSION, questions };
  return JSON.stringify(envelope);
}

export function getBankQuestions(bankKey: string): Question[] {
  if (typeof window === "undefined") return [];
  return parseBankStorage(localStorage.getItem(bankKey));
}

export function updateBank(question: Question, correct: boolean, bankKey: string): void {
  if (typeof window === "undefined") return;
  const bank = getBankQuestions(bankKey);
  const id = questionId(question);
  const updated = correct
    ? bank.filter((q) => questionId(q) !== id)
    : bank.some((q) => questionId(q) === id)
    ? bank
    : [...bank, question];
  localStorage.setItem(bankKey, serializeBankStorage(updated));
}

export function parseQuestionsArray(raw: unknown, sourceLabel: string): Question[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${sourceLabel}: expected an array of questions at the top level`);
  }
  return raw.map((item, i) => {
    try {
      return parseQuestion(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`${sourceLabel}[${i}]: ${msg}`);
    }
  });
}

async function fetchQuestions(dataFile: string): Promise<Question[]> {
  const res = await fetch(dataFile);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${dataFile}: ${res.status} ${res.statusText}`);
  }
  return parseQuestionsArray(await res.json(), dataFile);
}

export async function getQuestionsForClass(licenceClass: LicenceClass): Promise<Question[]> {
  return fetchQuestions(licenceClass.dataFile);
}

export async function getQuestionsForPracticeTest(
  licenceClass: LicenceClass,
  testId: string,
): Promise<Question[]> {
  const meta = licenceClass.tests[testId];
  if (!meta) return [];
  return fetchQuestions(meta.dataFile);
}
