# Test Coverage Improvement Report

_Updated: 2026-05-29 (cycle 3). Scope: the `web/` Next.js app, the only part of
the repo with a configured test runner. Supersedes the earlier 2026-05-29 cycle
(Gaps D / E1 / E2 — `getClassSummary`, the `TestRun` state machine, and the
home page), which is now merged to `main`._

## 1. Repository Test Overview

- **Language:** TypeScript (app) + CommonJS (data-pipeline scripts).
- **Test runner:** Vitest 4 (`web/vitest.config.ts`), jsdom environment,
  `@testing-library/react` for components.
- **Test command:** `npm test` (i.e. `vitest run`) inside `web/`.
- **Convention:** co-located `*.test.ts` / `*.test.tsx` next to the source.
  Setup file (`vitest.setup.ts`) clears `localStorage` after each test.
- **Root project (`scripts/`):** no runner of its own; the pure helpers in
  `scripts/image-cache.js` and `scripts/sync-helpers.js` are unit-tested from
  `web/lib/*.test.ts` via relative import. The stateful scripts
  (`scrape.js`, `sync-data.js`, `cache-images.js`) have no tests.

Baseline before this cycle: **10 test files, 112 tests, all passing.**

## 2. Current Coverage Quality Summary

Coverage is broad and assertion quality is high (behavior-focused, not
implementation-coupled). After the previous two cycles, every module has at
least some coverage:

- `lib/questions.ts` — `parseQuestion`, `parseQuestionsArray`,
  `deriveCorrectAnswerIndex`, `prepareTestQuestions`, `classifyTestId`, the
  missed-question bank (`getBankQuestions` / `parseBankStorage` /
  `updateBank` — add/dedupe/migrate/version), and `getQuestionsFor*` data-file
  resolution (happy path).
- `lib/questions.server.ts` — `getClassSummary` (per-test counts, summing,
  empty/parse-error handling, real-data invariant).
- `scripts/image-cache.js` / `scripts/sync-helpers.js` — well covered,
  including null/empty/unparseable input and the cache-rewrite opt-in.
- `components/` — `ProgressBar`, `BankCount`, `QuestionCard`, `TestResults`.
- `app/` — `Home` (links/labels/counts) and the `TestRun` state machine
  (empty bank, load error, a fetched question, and a single bank question
  scored to completion).

The remaining gaps are not whole untested modules but **specific
uncovered branches** inside otherwise-tested code, each of which maps to a
real, user-visible behavior:

1. `updateBank` is only exercised on a single-question bank, so its
   **selective removal** (remove one missed question, keep the rest) is unproven.
2. `getQuestionsFor*` is only tested on the happy path; its **fetch-failure and
   malformed-body error branches** are covered only indirectly through the
   route's generic `catch`.
3. The `TestRun` route is only tested on a one-question run, so the
   **question-advancement branch and multi-question score accumulation** are
   unproven.

## 3. Highest-Value Coverage Gaps

### Gap F — `updateBank` selective removal is untested
- **Location:** `web/lib/questions.ts` (`updateBank`)
- **Why it matters:** the missed-question bank is a core feature. When you
  answer a previously-missed question correctly, `updateBank` must remove **only
  that** question (`bank.filter((q) => questionId(q) !== id)`) and leave the rest
  of your review bank intact. A regression that cleared too much (or the wrong
  entry) would silently erase a user's study list.
- **Existing tests:** `updateBank` is covered for add-on-incorrect, dedupe,
  legacy migration, and remove-on-correct — but the remove case only ever has a
  **single** question in the bank (add one, remove that same one → empty), so
  selective removal among several entries is unproven. There is also no test
  that answering correctly a question **not** in the bank is a no-op.
- **Missing cases:** with two distinct missed questions, answering one correctly
  removes exactly that one and keeps the other (by `testName`/`questionNumber`
  identity, not array position); answering correctly a question absent from the
  bank leaves the bank unchanged.
- **Suggested tests:** seed the bank with Q1 and Q2 as incorrect; `updateBank(Q1,
  true)` → bank is `[Q2]`; `updateBank(Q3, true)` (never added) → bank unchanged.
- **Risk level:** Low (pure, deterministic, no async).
- **Validation:** `npm test -- lib/questions.test.ts`
- **Status:** Implemented (see §5, Improvement 1)

### Gap G — `getQuestionsFor*` error paths untested at the lib boundary
- **Location:** `web/lib/questions.ts` (`fetchQuestions`, via
  `getQuestionsForClass` / `getQuestionsForPracticeTest`)
- **Why it matters:** these are the only network boundary in the app. On a failed
  response, `fetchQuestions` throws a descriptive
  `Failed to fetch <file>: <status> <statusText>`; on a 200 whose body is not an
  array, it propagates `parseQuestionsArray`'s error naming the offending
  `dataFile`. Both messages are what surface in logs / `console.error` when a
  data file is missing or corrupt, yet they are exercised only indirectly through
  the route's catch (which collapses everything to one generic UI message).
- **Existing tests:** `data-file resolution` covers only `ok: true` happy paths
  (which file gets fetched). No test drives `res.ok === false` or a non-array
  body at the lib level.
- **Missing cases:** a non-ok response throws an error naming the file and the
  status/statusText; a 200 response whose JSON is not an array throws an error
  naming the `dataFile`.
- **Suggested tests:** stub `fetch` with `{ ok: false, status, statusText }` and
  assert `getQuestionsForClass` rejects with the file + status; stub a 200 with a
  non-array body and assert `getQuestionsForPracticeTest` rejects naming the file.
- **Risk level:** Low (`fetch` stubbed, deterministic, pattern already in the file).
- **Validation:** `npm test -- lib/questions.test.ts`
- **Status:** Implemented (see §5, Improvement 2)

### Gap H — quiz-route question advancement & multi-question scoring untested
- **Location:** `web/app/test/[testId]/page.tsx` (`TestRun.handleNext`)
- **Why it matters:** this is the core quiz loop. `handleNext` either advances
  (`setIndex((i) => i + 1)`) or finishes (`index + 1 >= questions.length →
  setDone(true)`), accumulating score along the way. The previous cycle tested
  only a **one-question** bank run, which finishes immediately — so the
  advancement branch, the progress counter moving (`1 / 2` → `2 / 2`), score
  accumulation across questions, and the non-bank PASS/FAIL results screen
  reached through the route are all unproven.
- **Existing tests:** `TestPage / TestRun state machine` covers the empty-bank
  message, a load error, a single fetched question rendering, and one bank
  question scored to `1 / 1`.
- **Missing cases:** a two-question (marathon) run where answering the first
  advances to the second (progress `1 / 2` → `2 / 2`); answering both correctly
  reaches `TestResults` with `2 / 2 correct` and the `100% PASS` (non-bank)
  screen; answering one of the two incorrectly yields a partial score.
- **Suggested tests:** stub `fetch` to return two questions with distinct,
  uniquely-identifiable correct options (so the right button can be clicked on
  each screen regardless of shuffle order); drive the run via the existing
  `useParams` mock and `findBy*` for the async load.
- **Risk level:** Low/Medium (async effects + Testing Library `findBy*`; follows
  the pattern established for Gap E1).
- **Validation:** `npm test -- "app/test/[testId]/page.test.tsx"`
- **Status:** Implemented (see §5, Improvement 3)

### Remaining (not planned this cycle)
- **`app/layout.tsx`:** renders `<html><body>{children}</body></html>` with
  static metadata — trivial, no logic worth a test.
- **Stateful pipeline scripts (`scrape.js`, `sync-data.js`, `cache-images.js`):**
  side-effecting (network, filesystem, Playwright); their pure cores are already
  extracted into `scripts/sync-helpers.js` / `scripts/image-cache.js` and tested.
- **`QuestionCard` `next/image` branch:** uses `next/image`, which the suite
  deliberately avoids.
- **`QuestionCard` form-field keyboard guard** (`e.target instanceof
  HTMLInputElement …`): defensive — there are no inputs in the card today, so a
  test would assert behavior the UI cannot currently produce.
- **`TestResults` `total === 0` (NaN%):** unreachable — the route renders the
  "no questions" screen before any zero-length run can reach results.
- **SSR guards in `getBankQuestions` / `updateBank`** (`typeof window ===
  "undefined"`): not reachable under the jsdom test environment.

## 4. Test Improvement Plan

Three improvements, each its own commit, validated after each:

1. **Gap F** — extend `web/lib/questions.test.ts` (`updateBank`) with
   selective-removal and correct-not-in-bank cases.
2. **Gap G** — extend `web/lib/questions.test.ts` with `getQuestionsFor*`
   fetch-failure and malformed-body error cases.
3. **Gap H** — extend `web/app/test/[testId]/page.test.tsx` with a
   two-question advancement / scoring run.

## 5. Implemented Test Improvements

### Improvement 1 — `updateBank` selective removal (Gap F)
- **Files changed:** `web/lib/questions.test.ts` (added cases to the existing
  `updateBank` suite).
- **Behavior covered:** correctly answering one missed question removes exactly
  that entry by identity and preserves the others; correctly answering a
  question that was never banked is a no-op.
- **New test cases:** with Q1 and Q2 both banked as incorrect, `updateBank(Q1,
  true)` leaves the bank as `[Q2]` (Q2's `questionNumber` intact); `updateBank`
  on a third, never-added question with `correct = true` leaves the two banked
  questions unchanged.
- **Validation run:** `npm test -- lib/questions.test.ts`, then `npm test`,
  `npm run lint`, `npx tsc --noEmit`.
- **Result:** new cases pass; full suite **112 → 114**; lint clean; the new
  cases add no `tsc` errors (only the pre-existing untyped-CommonJS-import nits
  in `lib/image-cache.test.ts` / `lib/sync-helpers.test.ts` remain).
- **Commit:** see git log (`test: improve coverage for the missed-question bank`).
- **Push result:** pushed to `origin/main`.

### Improvement 2 — `getQuestionsFor*` error paths (Gap G)
- **Files changed:** `web/lib/questions.test.ts` (new `getQuestionsFor* error
  handling` suite).
- **Behavior covered:** the network boundary's failure modes — a non-ok HTTP
  response and a 200 whose body is not a questions array.
- **New test cases:** `getQuestionsForClass` rejects with an error naming the
  data file and the `status`/`statusText` when `fetch` resolves `ok: false`;
  `getQuestionsForPracticeTest` rejects with the `parseQuestionsArray` message
  naming the `dataFile` when the 200 body is not an array.
- **Validation run:** `npm test -- lib/questions.test.ts`, then `npm test`,
  `npm run lint`, `npx tsc --noEmit`.
- **Result:** new cases pass; full suite **114 → 116**; lint clean; type-clean.
- **Commit:** see git log (`test: improve coverage for question fetch error handling`).
- **Push result:** pushed to `origin/main`.

### Improvement 3 — quiz-route advancement & scoring (Gap H)
- **Files changed:** `web/app/test/[testId]/page.test.tsx` (added cases to the
  existing `TestRun` suite).
- **Behavior covered:** the core answer loop across more than one question — the
  advancement branch, the progress counter, score accumulation, and the non-bank
  results screen reached through the route.
- **New test cases:** a two-question marathon run advances from `1 / 2` to
  `2 / 2` after the first answer; answering both correctly reaches `TestResults`
  with `2 / 2 correct` and `100% PASS`; answering exactly one correctly yields a
  partial `1 / 2 correct` / `FAIL` result.
- **Validation run:** `npm test -- "app/test/[testId]/page.test.tsx"`, then
  `npm test`, `npm run lint`, `npx tsc --noEmit`.
- **Result:** new cases pass; full suite grows accordingly; lint clean; type-clean.
- **Commit:** see git log (`test: improve coverage for quiz advancement and scoring`).
- **Push result:** pushed to `origin/main`.

## 6. Skipped Opportunities

- `app/layout.tsx` — trivial shell, no logic.
- Stateful pipeline scripts — side-effecting; pure cores already tested.
- `QuestionCard` `next/image` branch — intentionally avoided by the suite.
- `QuestionCard` form-field keyboard guard — defensive; no inputs exist to trigger it.
- `TestResults` `total === 0` — unreachable via the route.
- SSR guards in `getBankQuestions` / `updateBank` — not reachable under jsdom.

## 7. Final Notes

This cycle targets uncovered **branches** inside already-tested modules rather
than whole new files — the bank's selective-removal path, the fetch boundary's
error paths, and the quiz loop's multi-question advancement. Production code is
unchanged; all changes are additive test cases that follow the existing style.

The only standing non-test artifact remains the `server-only` resolve alias +
empty stub from the previous cycle (test infrastructure mirroring Next's own
`react-server` no-op; no effect on `next dev` / `next build`). A pre-existing
`tsc` nit (untyped CommonJS helper imports in `lib/image-cache.test.ts` /
`lib/sync-helpers.test.ts`) is unrelated to this cycle and left as-is.
</content>
</invoke>
