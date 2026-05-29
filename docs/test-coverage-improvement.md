# Test Coverage Improvement Report

_Generated: 2026-05-28. Scope: the `web/` Next.js app, which is the only part of
the repo with a configured test runner._

## 1. Repository Test Overview

- **Language:** TypeScript (app) + CommonJS (data-pipeline scripts).
- **Test runner:** Vitest 4 (`web/vitest.config.ts`), jsdom environment,
  `@testing-library/react` for components.
- **Test command:** `npm test` (i.e. `vitest run`) inside `web/`.
- **Convention:** co-located `*.test.ts` / `*.test.tsx` next to the source.
  Setup file clears `localStorage` after each test.
- **Root project (`scripts/`):** no runner of its own; the pure helpers in
  `scripts/image-cache.js` and `scripts/sync-helpers.js` are unit-tested from
  `web/lib/*.test.ts` via relative import. The stateful scripts
  (`scrape.js`, `sync-data.js`, `cache-images.js`) have no tests.

Baseline before this work: **5 test files, 84 tests, all passing.**

## 2. Current Coverage Quality Summary

Coverage of the pure/business logic is strong and assertion quality is high
(behavior-focused, not implementation-coupled):

- `lib/questions.ts` — thoroughly covered: `parseQuestion`,
  `parseQuestionsArray`, `deriveCorrectAnswerIndex`, `prepareTestQuestions`,
  `classifyTestId`, bank storage read/write/migration, and data-file resolution.
- `scripts/image-cache.js` and `scripts/sync-helpers.js` — well covered,
  including null/empty/unparseable input and the cache-rewrite opt-in.
- `components/QuestionCard.tsx` — mouse selection, correctness by stable index,
  and the Finish label are covered.
- `components/TestResults.tsx` — pass/fail threshold, bank mode, restart, link.

The gaps are concentrated in **untested presentational/stateful components** and
in **interaction paths of `QuestionCard` that are not exercised by mouse-only
tests** (keyboard navigation, answer locking, explanation reveal).

## 3. Highest-Value Coverage Gaps

### Gap A — `ProgressBar` is entirely untested
- **Location:** `web/components/ProgressBar.tsx`
- **Why it matters:** It performs the only arithmetic in the presentational
  layer — `Math.round((current / total) * 100)` — and drives a user-visible
  width and `current / total` label shown on every question.
- **Existing tests:** none.
- **Missing cases:** start (0%), completion (100%), rounding of non-integer
  percentages, and the textual counter.
- **Suggested tests:** render at representative `current/total` pairs and assert
  both the computed bar width and the counter text.
- **Risk level:** Low
- **Validation:** `npm test -- components/ProgressBar.test.tsx`
- **Status:** Implemented

### Gap B — `BankCount` is entirely untested
- **Location:** `web/components/BankCount.tsx`
- **Why it matters:** It has a user-visible conditional — render nothing when the
  missed-question bank is empty, otherwise a link to the bank — backed by
  `localStorage` through `useSyncExternalStore`. The empty branch is exactly the
  kind of conditional that regresses silently.
- **Existing tests:** none (the underlying `getBankQuestions` is tested, but the
  component's render decision and link target are not).
- **Missing cases:** empty bank → renders nothing; non-empty bank → renders the
  count, the `BANK_LABEL`, and a link to `/test/{bankId}`.
- **Suggested tests:** seed `localStorage` with `serializeBankStorage(...)`,
  render, assert the null/visible branches and the link `href`.
- **Risk level:** Low
- **Validation:** `npm test -- components/BankCount.test.tsx`
- **Status:** Implemented

### Gap C — `QuestionCard` keyboard / answer-lock / explanation paths untested
- **Location:** `web/components/QuestionCard.tsx`
- **Why it matters:** The keyboard handler (number keys select an option,
  Enter/Space advances) is a documented user-facing feature with real edge cases
  (out-of-range digits, typing inside inputs). Answer locking after the first
  selection and the explanation reveal are also user-visible and untested.
- **Existing tests:** mouse selection + correctness + Finish label only.
- **Missing cases:** number key selects the right option; Enter advances with the
  correct result; out-of-range digit is ignored; selection is locked after the
  first answer; explanation hidden before answering and shown after.
- **Suggested tests:** extend `components/QuestionCard.test.tsx` with
  `fireEvent.keyDown(window, ...)` and follow-up assertions.
- **Risk level:** Low
- **Validation:** `npm test -- components/QuestionCard.test.tsx`
- **Status:** Implemented

### Gap D — `lib/questions.server.ts` filesystem counting untested
- **Location:** `web/lib/questions.server.ts`
- **Why it matters:** `getClassSummary` reads each test's JSON from `public/` and
  reports per-test and total question counts shown on the home page.
- **Existing tests:** none.
- **Missing cases:** summing counts across a class; surfacing parse errors.
- **Risk level:** Medium — the module starts with `import "server-only"`, which
  throws under the jsdom/client test environment, so testing it needs a
  module-resolution shim or environment override rather than a plain import.
- **Validation:** `npm test -- lib/questions.server.test.ts`
- **Status:** Skipped (see §6)

### Gap E — App route components (`app/**/page.tsx`, `layout.tsx`) untested
- **Location:** `web/app/page.tsx`, `web/app/test/[testId]/page.tsx`,
  `web/app/layout.tsx`
- **Why it matters:** These wire data loading to the tested components.
- **Risk level:** Medium/High — async server components and `params` promises in
  this Next version make rendering them in jsdom high-effort and brittle for
  comparatively little marginal value over the component/lib tests.
- **Status:** Skipped (see §6)

## 4. Test Improvement Plan

Implement the three Low-risk gaps, each as its own commit, validating after each:

1. Add `components/ProgressBar.test.tsx` (Gap A).
2. Add `components/BankCount.test.tsx` (Gap B).
3. Extend `components/QuestionCard.test.tsx` with keyboard/lock/explanation
   coverage (Gap C).

Defer Gaps D and E as they require either environment shims or high-effort,
brittle route rendering.

## 5. Implemented Test Improvements

### Improvement 1 — `ProgressBar` (Gap A)
- **Files changed:** `web/components/ProgressBar.test.tsx` (new).
- **Behavior covered:** the `Math.round((current / total) * 100)` fill width and
  the `current / total` counter text.
- **New test cases:** counter text; 0% at start; 100% at completion; 25% partial
  fill; rounding of 1/3 → 33% and 2/3 → 67%.
- **Validation run:** `npm test -- components/ProgressBar.test.tsx`, then `npm test`.
- **Result:** 5/5 new tests pass; full suite 89/89 pass.
- **Commit:** `8afed7c` — `test: improve coverage for ProgressBar component`.
- **Push result:** pushed to `origin/chore/repo-cleanup-autopilot`.

### Improvement 2 — `BankCount` (Gap B)
- **Files changed:** `web/components/BankCount.test.tsx` (new).
- **Behavior covered:** the empty-bank branch (renders nothing) versus the
  populated branch (renders a link to `/test/{bankId}` with the count and label),
  and that the count is read from the supplied `bankKey`.
- **New test cases:** empty bank → no output and no link; populated bank → link
  `href` is `/test/bank` and `BANK_LABEL` shows; count text reflects the stored
  questions; a different `bankKey`/`bankId` pair is honored.
- **Validation run:** `npm test -- components/BankCount.test.tsx`, then `npm test`.
- **Result:** 4/4 new tests pass; full suite 93/93 pass.
- **Commit:** `bb40b42` — `test: improve coverage for BankCount component`.
- **Push result:** pushed to `origin/chore/repo-cleanup-autopilot`.

### Improvement 3 — `QuestionCard` keyboard / lock / explanation (Gap C)
- **Files changed:** `web/components/QuestionCard.test.tsx` (extended).
- **Behavior covered:** the keyboard handler (digit keys select by position;
  Enter and Space advance with the computed correctness), the ignore path for an
  out-of-range digit and for Enter before answering, the answer-lock that ignores
  clicks after the first selection, and the explanation reveal.
- **New test cases:** explanation hidden before / shown after answering; selection
  locked after first click; digit "2" selects the correct option and Enter
  advances `true`; digit "1" advances `false`; Space advances after a click;
  out-of-range digit "9" selects nothing and Enter does not advance.
- **Validation run:** `npm test -- components/QuestionCard.test.tsx`, then
  `npm test`, then `npm run lint`.
- **Result:** 11/11 file tests pass (6 new); full suite 99/99 pass; lint clean.
- **Commit:** `test: improve coverage for QuestionCard interactions` (see git log).
- **Push result:** pushed to `origin/chore/repo-cleanup-autopilot`.

## 6. Skipped Opportunities

- **`lib/questions.server.ts` (Gap D):** the `server-only` import guard makes a
  plain unit test throw in the jsdom environment. Testing it safely would mean
  introducing a `server-only` resolution alias or a per-file environment
  override — more machinery than a low-risk slice should add. Left for a
  dedicated change.
- **App route components (Gap E):** async server components + promised route
  params are high-effort to render under jsdom and would yield brittle tests.
- **`QuestionCard` image branch:** uses `next/image`, which the existing suite
  deliberately avoids; the keyboard/lock paths are higher value and lower risk.
- **Stateful pipeline scripts (`scrape.js`, `sync-data.js`, `cache-images.js`):**
  side-effecting (network, filesystem, Playwright); their pure cores are already
  extracted and tested.

## 7. Final Notes

Production code is unchanged. All additions are behavior-focused component tests
that follow the existing Vitest + Testing Library conventions.

Suite grew from **84 → 99 tests** (5 → 7 files). Remaining high-value gaps are
Gap D (`lib/questions.server.ts`, needs a `server-only` shim) and Gap E (app
route components), both deferred here as not low-risk.
