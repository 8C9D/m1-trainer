"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAllQuestions, type Question } from "@/lib/questions";
import { QuestionCard } from "@/components/QuestionCard";
import { ProgressBar } from "@/components/ProgressBar";

const TEST_LABELS: Record<string, string> = {
  "m1-practice-test-1": "Practice Test 1",
  "m1-practice-test-2": "Practice Test 2",
  "m1-practice-test-3": "Practice Test 3",
  "m1-practice-test-4": "Fines & Limits",
  "m1-practice-test-5": "Road Sign Test",
  all: "All Tests",
};

export default function TestPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getAllQuestions().then((all) => {
      const filtered = testId === "all" ? all : all.filter((q) => q.testName === testId);
      setQuestions(filtered);
      setIndex(0);
      setScore(0);
      setDone(false);
    });
  }, [testId]);

  const handleNext = (correct: boolean) => {
    if (correct) setScore((s) => s + 1);
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (questions.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 80;
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
        <p className={`text-4xl font-bold ${passed ? "text-green-600" : "text-red-500"}`}>
          {pct}%
        </p>
        <p className="text-sm text-gray-500">
          {score} / {questions.length} correct — {passed ? "Pass ✓" : "Not yet ✗"}
        </p>
        <p className="text-xs text-gray-400 mb-4">Passing score: 80%</p>
        <div className="flex gap-3">
          <button
            onClick={() => { setIndex(0); setScore(0); setDone(false); }}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
          >
            Restart
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            All tests
          </Link>
        </div>
      </main>
    );
  }

  const current = questions[index];

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← {TEST_LABELS[testId] ?? testId}
          </Link>
        </div>

        <ProgressBar current={index + 1} total={questions.length} />

        <QuestionCard
          key={`${testId}-${index}`}
          question={current}
          questionNumber={index + 1}
          total={questions.length}
          onNext={handleNext}
        />
      </div>
    </main>
  );
}
