# Test Coverage Improvement Report

_Updated: 2026-05-29 (cycle 4). Scope: the `web/` Next.js app, the only part of
the repo with a configured test runner. Supersedes the cycle-3 report (Gaps F /
G / H — `updateBank` selective removal, `getQuestionsFor*` error paths, and the
quiz-route advancement/scoring run), which is merged to `main`._

## 1. Repository Test Overview

- **Language:** TypeScript (app) + CommonJS (data-pipeline scripts).
- **Test runner:** Vitest 4 (`web/vitest.config.ts`), jsdom environment,
  `@testing-library/react` for components.
- **Test command:** `npm test` (i.e. `vitest run`) inside `web/`.
- **Convention:** co-located `*.test.ts` / `*.test.tsx` next to the source.
  Setup file (`vitest.setup.ts`) runs `cleanup()` and clears `localStorage`
  after each test.
- **Root project (`scripts/`):** no runner of its own; the pure helpers in
  `scripts/image-cache.js` and `scripts/sync-helpers.js` are unit-tested from
  `web/lib/*.test.ts` via relative import. The stateful scripts
  (`scrape.js`, `sync-data.js`, `cache-images.js`) have no tests.

Baseline before this cycle: **10 test files, 118 tests, all passing.**

## 2. Current Coverage Quality Summary

Coverage is broad and assertion quality is high (behavior-focused, not
implementation-coupled). After cycles 1–3 every module has meaningful coverage:

- `lib/questions.ts` — parsing/validation (`parseQuestion`,
  `parseQuestionsArray`, `deriveCorrectAnswerIndex`), `prepareTestQuestions`,
  `classifyTestId`, the missed-question bank (`getBankQuestions` /
  `parseBankStorage` / `updateBank` — add / dedupe / migrate / version /
  selective removal / no-op), and `getQuestionsFor*` data-file resolution plus
  its fetch-failure and malformed-body error paths.
- `lib/questions.server.ts` — `getClassSummary` (mocked-fs counts, empty file,
  no-tests, parse-error naming, and a real-data invariant smoke test).
- `scripts/image-cache.js` / `scripts/sync-helpers.js` — well covered, including
  null/empty/unparseable input and the cache-rewrite opt-in.
- `components/` — `ProgressBar`, `BankCount`, `QuestionCard`, `TestResults`.
- `app/` — `Home` (links/labels/counts) and the `TestRun` state machine
  (empty bank, load error, first-question render, single-bank scoring,
  two-question advancement, and a partial-score FAIL).

The remaining gaps are not whole untested modules but **specific uncovered
behaviors** inside otherwise-tested components, each mapping to a real,
user-visible behavior:

1. `BankCount` subscribes to the window `storage` event via
   `useSyncExternalStore`, but no test fires that event, so its **live
   reactivity** (the entire reason the external store + `subscribe` exist) is
   unproven.
2. `QuestionCard` renders ✓ / ✗ **answer-feedback markers** after an answer is
   chosen, but only the `onNext` boolean is asserted — the visual "which option
   was correct / which you picked" feedback is unverified.

## 3. Highest-Value Coverage Gaps

### Gap I — `BankCount` live reactivity to `storage` events is untested
- **Location:** `web/components/BankCount.tsx` (`subscribe` + `useSyncExternalStore`)
- **Why it matters:** the home page shows a "Missed Questions" link whose count
  must stay current. `BankCount` uses `useSyncExternalStore(subscribe, () =>
  getBankQuestions(bankKey).length, () => 0)`, where `subscribe` adds a `window`
  `storage` listener. That is what lets the count update live when the bank
  changes in another tab. If `subscribe` listened to the wrong event, or
  `getSnapshot` stopped re-reading, the count would silently go stale — and **no
  current test would catch it**, because all four `BankCount` tests assert only
  the initial render.
- **Existing tests:** empty → renders nothing; non-empty → link with href +
  count; count reflects the seeded size; reads from the given `bankKey`. All
  assert the *initial* snapshot only.
- **Missing cases:** after mount, changing the bank in `localStorage` and
  dispatching a `storage` event updates the rendered count (and can surface the
  link when it was previously hidden).
- **Suggested tests:** render with a 1-question bank ("1 questions"); inside
  `act(...)`, overwrite the bank with 3 questions and
  `window.dispatchEvent(new Event("storage"))`; assert "3 questions". Also:
  render empty (nothing shown) → seed + dispatch → link appears.
- **Risk level:** Low/Medium (jsdom event + `useSyncExternalStore`; needs `act`).
- **Validation:** `npm test -- components/BankCount.test.tsx`
- **Status:** Implemented (see §6, Improvement 1)

### Gap J — `QuestionCard` answer-feedback markers (✓ / ✗) are untested
- **Location:** `web/components/QuestionCard.tsx` (`getIndicator`)
- **Why it matters:** after an answer is chosen the card marks the **correct**
  option with ✓ and, when the user was wrong, marks **their** option with ✗.
  This is the primary "here is the right answer" feedback. It is distinct logic
  from scoring: the existing tests prove `onNext` fires with the right boolean,
  but a regression in `getIndicator` (e.g. marking the selected option instead
  of the correct one) would corrupt the on-screen feedback while leaving every
  scoring test green.
- **Existing tests:** selection → `onNext(true/false)`, stable-index
  correctness, Finish label, explanation reveal, selection lock, keyboard nav.
  None assert the ✓ / ✗ markers, which only appear after answering.
- **Missing cases:** before answering, neither marker is present; after picking a
  wrong option, the correct option's button shows ✓ and the chosen (wrong)
  option's button shows ✗, while an untouched option shows neither; answering
  correctly shows ✓ on the correct option and no ✗ anywhere.
- **Suggested tests:** render a question; assert no ✓/✗ before answering; click a
  wrong option; assert the correct option's button text contains ✓, the clicked
  option's button text contains ✗, and a third option's button contains neither.
- **Risk level:** Low (synchronous render + click; markers are user-visible text).
- **Validation:** `npm test -- components/QuestionCard.test.tsx`
- **Status:** Implemented (see §6, Improvement 2)

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
- **`QuestionCard` empty-explanation guard** (`answered && question.explanation`):
  low value — real data always has an explanation; the guard only suppresses an
  empty styled box.
- **`TestResults` `total === 0` (NaN%):** unreachable — the route renders the
  "no questions" screen before any zero-length run can reach results.
- **SSR guards in `getBankQuestions` / `updateBank`** (`typeof window ===
  "undefined"`): not reachable under the jsdom test environment.

## 4. Useless or Low-Value Tests

Every existing test was reviewed in this cycle; **none are recommended for
removal or replacement.** The suite is behavior-focused rather than
implementation-coupled:

- Component tests assert rendered text, roles, hrefs, and `onNext`/`onRestart`
  callbacks — observable behavior, not internals.
- `lib`/`scripts` tests assert returned values and thrown-error messages,
  including null/empty/invalid input.
- The two boundary-style helpers (`ProgressBar` reading the inline `width`
  style; the `getClassSummary` real-data smoke test) are the least "pure"
  assertions, but each still protects a real behavior (proportional fill;
  data/summary consistency) and asserts invariants rather than brittle exact
  values, so both are kept.

No mock-only, existence-only, duplicate, or snapshot tests were found.

## 5. Test Improvement Plan

Two improvements, each its own commit, validated after each:

1. **Gap I** — extend `web/components/BankCount.test.tsx` with a `storage`-event
   reactivity test.
2. **Gap J** — extend `web/components/QuestionCard.test.tsx` with ✓/✗
   answer-feedback marker assertions.

## 6. Implemented Test Improvements

### Improvement 1 — `BankCount` live reactivity (Gap I)
- **Files changed:** `web/components/BankCount.test.tsx` (added `act` to the
  Testing Library import; two new cases in the existing `BankCount` suite).
- **Behavior covered:** the `useSyncExternalStore` + `subscribe` reactivity — a
  `storage` event re-reads the bank and updates the rendered count live, and can
  surface the previously-hidden link.
- **New test cases:** with a 1-question bank rendered, growing the bank to 3 and
  dispatching `storage` updates "1 questions" → "3 questions"; starting empty
  (nothing rendered), seeding 2 + dispatching `storage` surfaces the
  `/test/bank` link showing "2 questions".
- **Validation run:** `npx vitest run components/BankCount.test.tsx`, then full
  `npx vitest run`, `npm run lint`, `npx tsc --noEmit`.
- **Result:** BankCount **4 → 6** tests; full suite **118 → 120**, all passing;
  lint clean; no new `tsc` errors (only the pre-existing untyped-CommonJS-import
  nits in `lib/image-cache.test.ts` / `lib/sync-helpers.test.ts` remain).
- **Status:** Implemented. Commit + push: see git log
  (`test: improve coverage for the missed-question bank count`).

### Improvement 2 — `QuestionCard` answer-feedback markers (Gap J)
- **Files changed:** `web/components/QuestionCard.test.tsx` (three new cases in
  the existing `QuestionCard` suite; no import changes).
- **Behavior covered:** `getIndicator`'s ✓/✗ feedback — hidden before
  answering; after a wrong pick the correct option shows ✓ and the chosen option
  shows ✗ (an untouched option shows neither); a correct pick shows ✓ on the
  correct option and no ✗ anywhere.
- **New test cases:** no ✓/✗ before answering; click a wrong option → correct
  option's button contains ✓, clicked option's button contains ✗, third option
  contains neither; click the correct option → its button contains ✓ and no ✗
  is present.
- **Validation run:** `npx vitest run components/QuestionCard.test.tsx`, then
  full `npx vitest run`, `npm run lint`, `npx tsc --noEmit`.
- **Result:** QuestionCard **10 → 13** tests; full suite **120 → 123**, all
  passing; lint clean; no new `tsc` errors (the 7 remaining are the pre-existing
  CommonJS-import nits in `lib/image-cache.test.ts` / `lib/sync-helpers.test.ts`).
- **Status:** Implemented. Commit + push: see git log
  (`test: improve coverage for answer-feedback markers`).

## 7. Skipped Opportunities

- `app/layout.tsx` — trivial shell, no logic.
- Stateful pipeline scripts — side-effecting; pure cores already tested.
- `QuestionCard` `next/image` branch — intentionally avoided by the suite.
- `QuestionCard` form-field keyboard guard — defensive; no inputs exist to trigger it.
- `QuestionCard` empty-explanation guard — low value; real data always has an explanation.
- `TestResults` `total === 0` — unreachable via the route.
- SSR guards in `getBankQuestions` / `updateBank` — not reachable under jsdom.

## 8. Final Notes

This cycle targets two uncovered **component behaviors** inside already-tested
files: `BankCount`'s external-store reactivity (its reason for using
`useSyncExternalStore` at all) and `QuestionCard`'s ✓/✗ answer feedback.
The suite grew **118 → 123 tests** (still 10 files; both additions extend
existing test files). Production code is unchanged; all changes are additive
test cases that follow the existing style.

The standing non-test artifact remains the `server-only` resolve alias + stub
from an earlier cycle (test infrastructure mirroring Next's own `react-server`
no-op; no effect on `next dev` / `next build`). A pre-existing `tsc` nit
(untyped CommonJS helper imports in `lib/image-cache.test.ts` /
`lib/sync-helpers.test.ts`) is unrelated to this cycle and left as-is.
