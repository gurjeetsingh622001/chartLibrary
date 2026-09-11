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
- [ ] Bar chart on core engine
- [ ] Pie chart on core engine
- [ ] Confirm shared scale/axis/tooltip code generalizes across chart types (no chart-type-specific config forks)

## Day 4 — React wrapper
- [ ] Container ref + instantiate core chart in effect hook
- [ ] Update on prop changes (no full teardown/rebuild)
- [ ] Destroy on unmount
- [ ] StrictMode double-invoke guard

## Day 5 — Angular wrapper
- [ ] Component with ElementRef
- [ ] `ngOnChanges` → update
- [ ] `ngOnDestroy` → destroy, verify no leaks
- [ ] Confirm no conflicts between core render loop and zone.js/change detection

## Day 6 — Polish and demo page
- [ ] Demo page: all chart types, React and Angular side by side
- [ ] Live-update scenario (push/randomize data on an interval) on both React and Angular versions — this is what actually proves the "no teardown/rebuild" differentiator, not just static rendering
- [ ] ResizeObserver-based responsive handling
- [ ] Visual parity check: React and Angular render identically for same config

## Day 7 — Documentation and case study
- [ ] Written case study (problem, why cross-framework consistency matters, code snippets)
- [ ] Root README (setup, architecture, screenshots/GIFs)
- [ ] Per-package README (core, react, angular) with install + minimal usage example

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
