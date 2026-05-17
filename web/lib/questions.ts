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
  explanation: string;
}

export interface Test {
  id: string;
  label: string;
  questions: Question[];
}

const TEST_META: Record<string, { label: string; order: number }> = {
  "m1-practice-test-1": { label: "Practice Test 1", order: 1 },
  "m1-practice-test-2": { label: "Practice Test 2", order: 2 },
  "m1-practice-test-3": { label: "Practice Test 3", order: 3 },
  "m1-practice-test-4": { label: "Fines & Limits", order: 4 },
  "m1-practice-test-5": { label: "Road Sign Test", order: 5 },
};

export async function getAllQuestions(): Promise<Question[]> {
  const res = await fetch("/data/all-questions.json");
  const raw = await res.json();
  return raw.map(({ testName, questionNumber, question, questionImageUrl, answerOptions, correctAnswer, explanation }: Question) => ({
    testName,
    questionNumber,
    question,
    questionImageUrl,
    answerOptions,
    correctAnswer,
    explanation,
  }));
}

export async function getTests(): Promise<Test[]> {
  const all = await getAllQuestions();
  const grouped = new Map<string, Question[]>();

  for (const q of all) {
    if (!grouped.has(q.testName)) grouped.set(q.testName, []);
    grouped.get(q.testName)!.push(q);
  }

  return [...grouped.entries()]
    .map(([id, questions]) => ({
      id,
      label: TEST_META[id]?.label ?? id,
      questions,
    }))
    .sort((a, b) => (TEST_META[a.id]?.order ?? 99) - (TEST_META[b.id]?.order ?? 99));
}
