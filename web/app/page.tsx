"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTests, type Test } from "@/lib/questions";

export default function Home() {
  const [tests, setTests] = useState<Test[]>([]);

  useEffect(() => {
    getTests().then(setTests);
  }, []);

  const total = tests.reduce((sum, t) => sum + t.questions.length, 0);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">M1 Practice Tests</h1>
        <p className="text-sm text-gray-500 mb-10">
          Ontario motorcycle licence — {total} questions
        </p>

        <div className="flex flex-col gap-2">
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/test/${test.id}`}
              className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors bg-white"
            >
              <span className="font-medium text-sm">{test.label}</span>
              <span className="text-sm text-gray-400">{test.questions.length} questions →</span>
            </Link>
          ))}

          {tests.length > 0 && (
            <Link
              href="/test/all"
              className="flex items-center justify-between px-4 py-4 border border-gray-900 rounded-lg hover:bg-gray-900 hover:text-white transition-colors bg-white mt-2"
            >
              <span className="font-medium text-sm">All tests</span>
              <span className="text-sm opacity-60">{total} questions →</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
