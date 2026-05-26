import Link from "next/link";

interface Props {
  score: number;
  total: number;
  isBank: boolean;
  onRestart: () => void;
}

export function TestResults({ score, total, isBank, onRestart }: Props) {
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 80;
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
        {score} / {total} correct
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
