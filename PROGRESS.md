# Progress Tracker

Tracks the 7-day plan from [chart-library-project-brief.md](chart-library-project-brief.md). Check items off as they're done; add notes inline when something changes from the original plan.

## Needs your decision (blocks Day 0 naming, not the architecture work)
- [ ] Library name
- [ ] Where the case study gets published (README / blog post / Upwork profile)

## Day 0 — Setup
- [x] pnpm workspace scaffold (`packages/core`, `packages/react`, `packages/angular`, `apps/demo`) — react/angular/demo are placeholders pending Day 4-6
- [x] Root tsconfig.base.json, pnpm-workspace.yaml
- [x] Define `ChartConfig` / `SeriesConfig` schema in `packages/core/src/types.ts` — series (with per-chart-type `line`/`bar`/`pie` slots), colors, axis (type + ticks/labels/gridlines), tooltip, legend, title, animation, margin, size. `install`/`build`/`test`/`lint` all verified working end to end.
- [x] Decide core event API shape: went with instance-level pub-sub (`chart.on`/`chart.off`, see `packages/core/src/Chart.ts`) so React/Angular can each map it to their native idiom later
- [x] Decide `update(partialConfig)` semantics: partial merge, typed as `ChartConfigUpdate`. Diffing to pick the minimal action (repatch data / restyle / full relayout) is still a Day 1-2 TODO — the shape is locked, the behavior isn't built yet.
- [x] Decide empty/invalid data behavior: documented in the brief and left as a `// TODO (Day 1-2)` marker in `Chart.ts` — not implemented yet, decision recorded so it isn't forgotten
- [x] Pin React (18+) and Angular (latest stable, standalone component) target versions; set up ESLint (flat config) + Prettier shared config — `pnpm lint` passes clean
- [x] Add LICENSE file (MIT) at repo root

## Day 1-2 — Core engine
- [x] Data input handling — `cleanPoints()` skips points with missing/non-finite x or y instead of throwing (per the "empty/invalid data" decision)
- [x] Scale + axis calculation — `internal/scale.ts` (linear scale, band scale, nice-number tick generation), fully unit tested
- [x] SVG rendering for line chart — axis lines/ticks/labels, gridlines, per-series `<path>` (linear/step/monotone curve), point circles
- [x] Basic animation — opacity fade-in on mount, CSS `transition` on `d` so subsequent updates animate
- [x] `update()` method — real partial-merge + diff, not a stub: non-structural changes patch existing nodes (`patch()`), structural changes (series added/removed/reordered, type changed) rebuild (`renderFull()`)
- [x] `destroy()` method
- [x] Default color palette + per-series color override wired into config (`internal/color.ts`)
- [x] Axis config (type, tick count, label formatter, gridlines) wired into config
- [x] Tooltip hook wired into config and functional (hover shows formatter output or a default `name: value`, not just typed) — styling is inline/minimal, not the deferred full theming system
- [x] Unit tests for scale calculation, tick generation, data-to-pixel mapping (Vitest) — plus tests proving the actual "patch, don't rebuild" behavior: same `<svg>`/`<path>` node references before/after a data-only `update()`, and a `<path>` count/`<svg>` reference change on a structural update
- [x] Legend (render + click-to-toggle a series' visibility, calls `legend.onToggle`) and title rendering — Day 0 schema items, wired in now since the rendering pipeline needed them anyway
- [ ] Bar/pie mark rendering, ResizeObserver responsive hookup — left for Day 3/6 as planned; `computeLayout()`/scales are already shared and type-agnostic so those days should mostly be adding a mark-rendering step, not new plumbing

## Day 3 — Expand chart types
- [x] Bar chart on core engine — grouped (default) and stacked (`series.bar.stacked`), reusing `computeLayout()`'s band/linear scales and axis rendering. Y-domain calculation is now chart-type-aware (`computeYDomain()`) to sum stacked values instead of taking a flat max.
- [x] Pie chart on core engine — separate layout/render path (`computePieLayout`/`applyPieLayout`) since it has no axes; slice angle math and arc path generation live in `internal/arc.ts`, unit tested. Supports donut mode (`series.pie.innerRadius`) and inside/outside labels.
- [x] Confirm shared scale/axis/tooltip code generalizes across chart types — line and bar share `computeLayout()`/axis rendering/tooltip/legend with no per-type forking there; only the mark-rendering step (`renderPoints` vs `renderBars`) and y-domain calc differ. Pie intentionally does not share axis code since it has none — reuses only color resolution, tooltip, and the legend pattern.
- [x] Refactored `RenderState` to a single `seriesGroups: Map<id, <g>>` (each series gets one persistent wrapper element) instead of separate line-specific maps, so line and bar visibility-toggling and patch-vs-rebuild logic is now unified rather than duplicated per type
- [x] Tests: bar rect count/stacked-domain/click, pie slice count/add-remove-category reference-equality (proves patch reuses existing `<path>` slices, not just line's)/click/legend — 58 tests total, all passing

## Day 4 — React wrapper
- [x] Container ref + instantiate core chart in effect hook (`packages/react/src/Chart.tsx`)
- [x] Update on prop changes (no full teardown/rebuild) — a separate effect calls `chart.update(config)`, mount effect has empty deps so the instance is never recreated on prop changes; skips the redundant no-op update on initial mount
- [x] Destroy on unmount
- [x] StrictMode double-invoke guard — no guard flag needed; destroy() fully tears down the container/listeners so re-running the mount effect is idempotent by construction (a skip-flag would just mask what StrictMode is trying to surface). Verified with a test that renders inside `<StrictMode>` and asserts exactly one `<svg>`/`<path>` exists, not zero or two.
- [x] `onDataPointClick`/`onDataPointHover` props map onto the core's `chart.on`/`chart.off` pub-sub — the cross-framework event API decision from Day 0 paying off as intended
- [x] Dev tooling: `eslint-plugin-react-hooks` added (workspace-wide config, scoped to `packages/react/**`) so `exhaustive-deps` actually enforces the intentional mount-effect dependency omission rather than silently drifting
- [x] Test setup resolves `@chart-lib/core` to its source via a Vite alias (`packages/react/vitest.config.ts`) rather than requiring core to be built first — `pnpm test` works standalone on a fresh checkout; `tsc --noEmit` still typechecks against core's built `.d.ts` (its public surface), so build order only matters for typecheck, not tests
- [x] 8 tests: mount/StrictMode/patch-in-place/structural-rebuild/destroy/event wiring (click, hover, and handler removal)

## Day 5 — Angular wrapper
- [x] Standalone component using the host element itself as the container (no `@ViewChild`/template needed — `ElementRef` in the constructor already refers to the host), `ngAfterViewInit` creates the chart
- [x] `ngOnChanges` → `update()` — guarded by `if (!this.chart ...)`, which naturally skips the very first change (the constructor call in `ngAfterViewInit` hasn't run yet on Angular's first `ngOnChanges`, so there's nothing to patch), no separate "is this the first call" flag needed unlike the React wrapper
- [x] `ngOnDestroy` → `destroy()`, chart reference cleared
- [x] Confirmed no conflicts between core render loop and zone.js/change detection — this was the real work of the day, not just a checkbox: zone.js globally patches `addEventListener`/`requestAnimationFrame`, so without care every chart hover/click and mount-fade animation frame would trigger a full Angular change-detection pass. All core instantiation/update/destroy work runs inside `ngZone.runOutsideAngular()`; only the `@Output` emissions (`dataPointClick`/`dataPointHover`) explicitly re-enter via `ngZone.run()`. Verified in tests with a fake `NgZone` asserting `runOutsideAngular`/`run` are actually called, not just present in the type signature.
- [x] SSR guard: platform check (`platformId === 'browser'`) skips chart creation entirely on the server — cheap to add, and Angular Universal (unlike React) actually runs lifecycle hooks server-side, so this one is a real gap if skipped, not a hypothetical
- [x] **Real finding**: importing `isPlatformBrowser` from `@angular/common` failed at module load ("JIT compilation failed for injectable `PlatformNavigation`") — `@angular/common`'s Ivy partially-compiled output needs the Angular Linker or the JIT compiler to load outside a full Angular CLI build pipeline. Since `isPlatformBrowser` is a one-line check internally, inlined it (`platformId === 'browser'`) and dropped the `@angular/common` dependency entirely rather than pulling in `@angular/compiler` just to work around it.
- [x] **Known gap, tracked not hidden**: still built with tsup as a placeholder, same as the react/angular scaffold from Day 0. A real publishable Angular library needs `ng-packagr` (Ivy partial compilation + Angular Linker-compatible output). Originally scoped this as "fine for the demo app, only matters at npm-publish time" — **that assumption turned out to be wrong**: tsup/esbuild's lack of `emitDecoratorMetadata` support broke the component's Angular DI outright (`NG0202`, see Day 6), which surfaced the moment the demo app actually ran it in a browser, not at publish time. Worked around with explicit `@Inject()` tokens rather than switching build tools — `ng-packagr` migration is still tracked under Day 7, but is no longer assumed to be a "nice to have."
- [x] Tests (9): chart creation via host element, SSR no-op, `runOutsideAngular` actually invoked, `ngOnChanges` skip-before-mount and patch-after-mount, unrelated-change no-op, destroy clears host, click/hover emit through `ngZone.run`

## Day 6 — Polish and demo page
- [x] Demo page (`apps/demo`): React mounted in `#react-root`, Angular bootstrapped into `<chart-demo-root>`, both on one page. Line/bar/pie all render, built from **the same config-construction functions** (`apps/demo/src/sample-data.ts`) shared by both frameworks — visual parity is enforced by shared code, not by eyeballing two separately-authored configs.
- [x] Live-update scenario — a "Randomize now" button plus a toggleable 2s auto-update interval on the line chart, on both sides. Each side reads its own rendered `<svg>` node before/after an update and reports on-page whether it's the same node — the actual differentiator claim, checked live, not just asserted in a README.
- [x] ResizeObserver-based responsive handling — implemented in the **core engine**, not the wrappers (`config.responsive: true` + no fixed width/height), so both React and Angular get it automatically with zero wrapper-specific code. A resize triggers the same `patch()` path as a data update (in-place relayout, same `<svg>` node), not a rebuild. Explicit width/height always wins over container size if both are set. Tested with a fake `ResizeObserver` (real DOM test environments don't implement one meaningfully) — 6 tests: observes only when eligible, disconnects on destroy, starts/stops via `update()`, and relayouts in place on a simulated resize.
- [x] Visual parity check — confirmed by actually running the demo (Playwright-driven, headless Chromium) and comparing screenshots, not just by writing the shared-config code and assuming it works.
- [x] **Two real bugs found only by actually running the demo in a browser, not by the unit test suites**:
  - `NG0202` at Angular DI factory construction (`ChartComponent`'s constructor parameters 0/1 — `ElementRef`, `NgZone` — couldn't be resolved). Root cause: Angular's implicit constructor-type-based DI needs TypeScript's `emitDecoratorMetadata`, which **esbuild does not implement** (no type checker). Since the package is built with tsup/esbuild, this would break for *any* real Angular consumer, not just this demo — not a "needs ng-packagr eventually" nicety as originally scoped in Day 5, but a correctness bug. Fixed with explicit `@Inject()` tokens for every constructor parameter (works without needing that metadata at all). The component's own unit tests never caught this because they construct the class directly with `new`, bypassing Angular's DI factory entirely — a real gap in that test approach, now noted in the demo README.
  - `@angular/platform-browser`'s `bootstrapApplication` transitively loads `@angular/common`'s Ivy partially-compiled code, which throws synchronously at import time without the JIT compiler loaded — and because that throw happens during module evaluation, it silently took the *React* half of the page down with it too (both bootstraps live in one script). Fixed with `import '@angular/compiler';` first in `main.tsx`, mirroring the same root cause hit in Day 5's Angular component tests.
- [x] Also found (in the demo's own code, not the library): the React proof-check had a StrictMode-only race — reading the "before" `<svg>` reference passively on every render could occasionally capture it during React 18 dev-mode's double-invoke mount churn, producing a false "svg changed" warning on the very first check. Fixed by capturing the "before" reference explicitly at the moment a randomize is triggered instead of passively via a mount-time effect. Verified fixed across repeated fresh-page-load runs.

## Day 7 — Documentation and case study
- [x] Written case study ([docs/CASE_STUDY.md](docs/CASE_STUDY.md)) — problem, architecture, the `update()`/zone.js technical decisions with real code snippets pulled from the actual source (not paraphrased), and the two real bugs Day 6's browser verification found, written up honestly rather than smoothed over
- [x] Root README — pitch, architecture, a real screenshot from the actual browser-verified demo run (`docs/screenshots/`), setup instructions, package table, status/open-decisions pointer
- [x] Per-package README (core, react, angular) with install + a minimal usage example matching the real current API (checked against source, not written from memory) — the angular one is explicit that the package isn't npm-publish-ready as built (tsup vs. `ng-packagr`), not just quietly hoping nobody notices
- [ ] If actually publishing the angular package: swap its tsup build for `ng-packagr` (needed for Ivy partial-compilation/Angular Linker-compatible output — see Day 5/6 notes, this turned out to matter more than originally scoped)

## Deferred (post-portfolio, not week-1 scope)
- [ ] Canvas/WebGL rendering mode
- [ ] Additional chart types (scatter, area, candlestick)
- [ ] Vue wrapper
- [ ] Real-time streaming data support
- [ ] Accessibility pass (ARIA, keyboard nav, data table fallback)
- [ ] Full CSS-variable/token-based theming system
- [ ] Rich tooltip HTML templates
- [ ] Secondary/multiple y-axes
- [ ] Locale-aware number/date formatting defaults
- [ ] Crosshair, zoom/pan
- [ ] Legend click-to-toggle-series behavior (`legend.onToggle`)
- [ ] npm publish (optional but a strong credibility signal if done)
