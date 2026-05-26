import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseQuestionsArray, type LicenceClass } from "./questions";

export interface PracticeTestSummary {
  id: string;
  label: string;
  count: number;
}

export interface LicenceClassSummary {
  tests: PracticeTestSummary[];
  totalQuestions: number;
}

function countValidQuestions(publicPath: string): number {
  const fsPath = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  const raw: unknown = JSON.parse(fs.readFileSync(fsPath, "utf-8"));
  return parseQuestionsArray(raw, publicPath).length;
}

export function getClassSummary(licenceClass: LicenceClass): LicenceClassSummary {
  const tests: PracticeTestSummary[] = licenceClass.tests.map((test) => ({
    id: test.id,
    label: test.label,
    count: countValidQuestions(test.dataFile),
  }));
  const totalQuestions = tests.reduce((sum, t) => sum + t.count, 0);
  return { tests, totalQuestions };
}
