# Demo app

`pnpm --filter demo dev` — runs at http://localhost:5173.

A single page with React and Angular mounted side by side (`#react-root` for React, `<chart-demo-root>` for Angular — see `src/main.tsx`). Both sides render from the exact same config-construction functions in `src/sample-data.ts`, which is what actually proves visual parity between the wrappers, not two separately-authored configs that happen to look similar.

The line chart on each side has a "Randomize now" button and an auto-update toggle (every 2s). Each side reads its own rendered `<svg>` node before and after an update and reports whether it's the *same* node — that's the actual proof that `update()` patches in place instead of tearing down and rebuilding, which is the whole point of this project. Verified manually in a real browser (Playwright-driven) as well as in the packages' own unit tests.

## Running both frameworks on one page — what actually happened

This was flagged as an open technical question before it was built; here's what it took:

- **Mixed JSX + Angular decorators in one Vite build**: works out of the box — Vite's esbuild-based transform handles `.tsx` (JSX, via `@vitejs/plugin-react`) and `.ts` (`experimentalDecorators`) independently per file, no conflict.
- **`@angular/common`'s Ivy partially-compiled code** (`PlatformNavigation`, pulled in transitively by `@angular/platform-browser`'s `bootstrapApplication`) throws at import time without the JIT compiler loaded — fixed with `import '@angular/compiler';` as the first import in `main.tsx`. Since this throws synchronously during module evaluation, it would otherwise take the *entire* script down before either framework's bootstrap code ran, including React's — not just Angular's.
- **Angular's constructor-parameter DI needs `emitDecoratorMetadata`**, which esbuild does not implement (no type checker to resolve it). `ChartComponent`'s constructor uses explicit `@Inject()` tokens for every parameter specifically so it works when built with tsup/esbuild rather than requiring `ng-packagr` — see the comment in `packages/angular/src/chart.component.ts`. This was caught by actually running the demo in a browser, not by the component's own unit tests, which construct the class directly with `new` and never exercise Angular's DI factory at all.
- **zone.js loaded once, globally, first** (`import 'zone.js';`, also first in `main.tsx`) — required for `NgZone` to do anything real in the Angular wrapper. No conflicts observed with React's own event handling in practice (checked via console errors across multiple runs), though this is a case neither framework is really designed for, so it's worth a second look if odd cross-framework event timing ever shows up.

## Structure

- `sample-data.ts` — shared `ChartConfig` builders used by both frameworks
- `react-app.tsx` — React demo (line/bar/pie, live-update, in-place-patch proof)
- `angular-app.component.ts` — Angular demo, same structure and behavior
- `main.tsx` — loads zone.js and the JIT compiler, bootstraps both apps
