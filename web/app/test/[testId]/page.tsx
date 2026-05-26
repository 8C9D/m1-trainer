"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getBankQuestions,
  updateBank,
  prepareTestQuestions,
  getTestLabel,
  getLicenceClassForTestId,
  isBankTest,
  getQuestionsForClass,
  getQuestionsForPracticeTest,
  type Question,
} from "@/lib/questions";
import { QuestionCard } from "@/components/QuestionCard";
import { ProgressBar } from "@/components/ProgressBar";

export default function TestPage() {
  const { testId } = useParams<{ testId: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  // Remount the runner on testId change or Restart so its progress state
  // (questions, index, score, done, loaded, error) resets via React
  // reconciliation. This avoids cascading setStates inside an effect
  // (react-hooks/set-state-in-effect).
  return (
    <TestRun
      key={`${testId}-${reloadKey}`}
      testId={testId}
      onRestart={() => setReloadKey((k) => k + 1)}
    />
  );
}

function TestRun({ testId, onRestart }: { testId: string; onRestart: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const licenceClass = getLicenceClassForTestId(testId);
  const bankKey = licenceClass?.bankKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let base: Question[] = [];
        if (licenceClass) {
          if (testId === licenceClass.bankId) {
            base = getBankQuestions(licenceClass.bankKey);
          } else if (testId === licenceClass.marathonId) {
            base = await getQuestionsForClass(licenceClass);
          } else {
            base = await getQuestionsForPracticeTest(licenceClass, testId);
          }
        }
        if (cancelled) return;
        setQuestions(prepareTestQuestions(base));
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load questions:", e);
        setQuestions([]);
        setError("Could not load questions. Please try again later.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId, licenceClass]);

  const handleNext = (correct: boolean) => {
    if (bankKey) updateBank(questions[index], correct, bankKey);
    if (correct) setScore((s) => s + 1);
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!loaded) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
          All tests
        </Link>
      </main>
    );
  }

  if (loaded && questions.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-sm text-gray-500">No missed questions yet.</p>
        <Link href="/" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
          All tests
        </Link>
      </main>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 80;
    const isBank = isBankTest(testId);
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
        {isBank ? (
          <p className="text-4xl font-bold text-gray-900">Review Complete</p>
        ) : (
          <p className={`text-4xl font-bold ${passed ? "text-green-600" : "text-red-500"}`}>
            {pct}% {passed ? "PASS" : "FAIL"}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {score} / {questions.length} correct
        </p>
        {!isBank && <p className="text-xs text-gray-400 mb-4">Passing score: 80%</p>}
        <div className={`flex gap-3 ${isBank ? "mt-4" : ""}`}>
          <button
            onClick={onRestart}
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
            ← {getTestLabel(testId)}
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
