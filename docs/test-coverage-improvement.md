# Test Coverage Improvement Report

_Updated: 2026-05-29. Scope: the `web/` Next.js app, the only part of the repo
with a configured test runner. Supersedes the 2026-05-28 cycle (ProgressBar /
BankCount / QuestionCard), which is now merged to `main`._

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

Baseline before this cycle: **7 test files, 99 tests, all passing.**

## 2. Current Coverage Quality Summary

Coverage of the pure/business logic is strong and assertion quality is high
(behavior-focused, not implementation-coupled):

- `lib/questions.ts` — thoroughly covered: `parseQuestion`,
  `parseQuestionsArray`, `deriveCorrectAnswerIndex`, `prepareTestQuestions`,
  `classifyTestId`, the missed-question bank (`getBankQuestions` / `updateBank`
  add/remove/dedupe/migrate), and `getQuestionsFor*` data-file resolution.
- `scripts/image-cache.js` and `scripts/sync-helpers.js` — well covered,
  including null/empty/unparseable input and the cache-rewrite opt-in.
- `components/` — `ProgressBar`, `BankCount`, `QuestionCard` (mouse + keyboard +
  answer-lock + explanation), and `TestResults` are all covered.

The gaps are concentrated in code that is not a plain client component or pure
helper: the **`server-only` summary module** that feeds the home page, and the
**App Router route components** (`app/page.tsx` and the `TestRun` state machine
in `app/test/[testId]/page.tsx`), which were deferred in the previous cycle as
needing test infrastructure (a `server-only` resolver) or as async/stateful.

## 3. Highest-Value Coverage Gaps

### Gap D — `lib/questions.server.ts` (`getClassSummary`) untested
- **Location:** `web/lib/questions.server.ts`
- **Why it matters:** `getClassSummary` reads each practice test's JSON from
  `public/`, counts the valid questions, and reports per-test and total counts —
  the numbers shown on every row of the home page. A regression here (bad
  summing, a file that fails to parse) is user-visible and silent.
- **Existing tests:** none.
- **Why it was deferred:** the module starts with `import "server-only"`, which
  is a Next.js build-time alias, not an installed package, so it is
  **unresolvable under Vitest** (`vi.mock` cannot intercept it either — Vite's
  import-analysis fails to resolve the specifier before the mock applies).
- **Resolution this cycle:** add a one-line `resolve.alias` in
  `vitest.config.ts` mapping `server-only` to an empty stub
  (`web/test/server-only-stub.ts`) — exactly what Next's `react-server` export
  condition does. Test infrastructure only; does not affect `next dev`/`build`.
- **Missing cases:** summing counts across a class; per-test id/label/count
  mapping; surfacing a parse error that names the offending data file; an
  empty class. Plus a real-data invariant smoke check (total == sum of parts).
- **Risk level:** Low (after the alias).
- **Validation:** `npm test -- lib/questions.server.test.ts`
- **Status:** Planned

### Gap E1 — `app/test/[testId]/page.tsx` (`TestRun`) state machine untested
- **Location:** `web/app/test/[testId]/page.tsx`
- **Why it matters:** This is the core quiz loop. `TestRun` is a small state
  machine: classify the route id → load questions (bank from `localStorage`,
  marathon/practice via `fetch`) → render loading / error / "no missed
  questions" / question / results, track the score, and write the missed-question
  bank on each answer. None of these branches is currently tested.
- **Existing tests:** none for the route; the underlying lib functions are
  tested in isolation.
- **Missing cases:** empty bank → "No missed questions yet."; load failure →
  error message + "All tests" link; a loaded question renders with the progress
  counter; answering the last question correctly reaches `TestResults`, scores
  `1 / 1`, and removes the question from the bank.
- **Approach:** mock `next/navigation`'s `useParams` to control the route id;
  drive bank mode via seeded `localStorage` (no fetch, no shuffling ambiguity)
  and the fetch paths via a stubbed `fetch`. Real component behavior is
  exercised end to end; only the route-param and network boundaries are doubled.
- **Risk level:** Medium (async effects + Testing Library `waitFor`).
- **Validation:** `npm test -- "app/test/[testId]/page.test.tsx"`
- **Status:** Planned

### Gap E2 — `app/page.tsx` (`Home`) untested
- **Location:** `web/app/page.tsx`
- **Why it matters:** The home page maps each licence class's summary to a list
  of test links (with question counts), a Marathon link, and the bank link.
  The href wiring and the count display are user-visible and easy to break.
- **Existing tests:** none.
- **Missing cases:** both licence-class sections render; one link per practice
  test with the right `href` (`/test/{id}`) and label; the Marathon link
  (`/test/{marathonId}`) shows the class total; the displayed total equals the
  sum of the per-test counts.
- **Approach:** `Home` is a synchronous server component; with the `server-only`
  alias it renders under jsdom and reads the real `public/data` files. Assert
  structure/hrefs/labels and the total==sum invariant rather than brittle exact
  counts.
- **Risk level:** Low/Medium.
- **Validation:** `npm test -- app/page.test.tsx`
- **Status:** Planned

### Remaining (not planned this cycle)
- **`app/layout.tsx`:** renders `<html><body>{children}</body></html>` with
  static metadata — trivial, no logic worth a test.
- **Stateful pipeline scripts (`scrape.js`, `sync-data.js`, `cache-images.js`):**
  side-effecting (network, filesystem, Playwright); their pure cores are already
  extracted into `scripts/sync-helpers.js` / `scripts/image-cache.js` and tested.
- **`QuestionCard` image branch:** uses `next/image`, which the suite
  deliberately avoids.

## 4. Test Improvement Plan

Three improvements, each its own commit, validated after each:

1. **Gap D** — add the `server-only` alias + stub, and add
   `web/lib/questions.server.test.ts`.
2. **Gap E1** — add `web/app/test/[testId]/page.test.tsx` for the `TestRun`
   state machine.
3. **Gap E2** — add `web/app/page.test.tsx` for the home page.

## 5. Implemented Test Improvements

_Filled in as each improvement lands._

## 6. Skipped Opportunities

- `app/layout.tsx` — trivial shell, no logic.
- Stateful pipeline scripts — side-effecting; pure cores already tested.
- `QuestionCard` `next/image` branch — intentionally avoided by the suite.

## 7. Final Notes

Production code is unchanged. The only non-test change is a `server-only`
resolve alias in `vitest.config.ts` plus the empty stub it points at — test
infrastructure that mirrors Next's own `react-server` no-op and does not affect
`next dev` or `next build`.
