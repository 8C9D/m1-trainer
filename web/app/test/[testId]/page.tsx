"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getBankQuestions,
  updateBank,
  prepareTestQuestions,
  classifyTestId,
  getQuestionsForClass,
  getQuestionsForPracticeTest,
  type Question,
} from "@/lib/questions";
import { QuestionCard } from "@/components/QuestionCard";
import { ProgressBar } from "@/components/ProgressBar";
import { TestResults } from "@/components/TestResults";

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
      {children}
    </main>
  );
}

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

  const classified = useMemo(() => classifyTestId(testId), [testId]);
  const bankKey =
    classified.kind === "unknown" ? undefined : classified.licenceClass.bankKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let base: Question[] = [];
        switch (classified.kind) {
          case "bank":
            base = getBankQuestions(classified.licenceClass.bankKey);
            break;
          case "marathon":
            base = await getQuestionsForClass(classified.licenceClass);
            break;
          case "practice":
            base = await getQuestionsForPracticeTest(classified.licenceClass, testId);
            break;
          case "unknown":
            base = [];
            break;
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
  }, [testId, classified]);

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
      <CenteredMessage>
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
          All tests
        </Link>
      </CenteredMessage>
    );
  }

  if (loaded && questions.length === 0) {
    return (
      <CenteredMessage>
        <p className="text-sm text-gray-500">No missed questions yet.</p>
        <Link href="/" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
          All tests
        </Link>
      </CenteredMessage>
    );
  }

  if (done) {
    return (
      <TestResults
        score={score}
        total={questions.length}
        isBank={classified.kind === "bank"}
        onRestart={onRestart}
      />
    );
  }

  const current = questions[index];

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← {classified.label}
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
