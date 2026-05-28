# g1m1-trainer — web app

The Next.js 16 (App Router) practice-test trainer. It reads the published
question JSON from `public/data/` and quizzes one question at a time with
shuffling, keyboard shortcuts, score reporting, and a `localStorage`-backed
"missed questions" bank.

For project-wide setup, the scraper, the data pipeline, and deployment notes,
see the [root README](../README.md).

## Commands

Run from this `web/` directory:

```bash
npm run dev         # start the dev server on http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm test            # vitest run (unit + component tests)
npm run test:watch  # vitest in watch mode
```

`predev` and `prebuild` automatically run `../scripts/sync-data.js`, which
mirrors `data/` into `public/data/`. Day-to-day web development therefore does
not require a manual sync — see the [root README](../README.md) for details.
