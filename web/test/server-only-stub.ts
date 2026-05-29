// Test-only stub for the `server-only` package.
//
// `server-only` is not an installed dependency; Next.js resolves it at build
// time (its `react-server` export condition points at an empty module, and the
// default condition throws to flag accidental client imports). Under Vitest
// there is no such resolver, so any module that does `import "server-only"`
// (e.g. lib/questions.server.ts) fails to resolve.
//
// Aliasing `server-only` to this empty module in vitest.config.ts mirrors what
// the real `react-server` build does — a no-op — so server-only modules can be
// unit-tested. It is purely test infrastructure and does not affect `next dev`
// or `next build`.
export {};
