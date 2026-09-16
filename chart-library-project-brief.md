# Cross-Framework Chart Library — Project Brief

## Goal
Build a lightweight, framework-agnostic charting library (named **SulaCharts**, decided after the initial build — see "Open Decisions" below) as an Upwork portfolio project. The library's core rendering engine is written in plain TypeScript and rendered as SVG, with thin, idiomatic wrapper packages for React and Angular. The goal is not to compete with Highcharts/ECharts on feature breadth, but to demonstrate strong architecture, cross-framework compatibility, and clean rendering code as a portfolio piece.

## Differentiation / Why Build This
Existing chart libraries (Highcharts, ECharts, Chart.js, Nivo, Recharts, Visx, ApexCharts) are mature and cover most use cases, but a consistent, validated pain point across developer forums and GitHub issues is:
- Framework wrappers are treated as an afterthought bolted onto a vanilla JS core, so behavior is inconsistent between React and Angular.
- React: careless updates trigger full chart teardown/rebuild instead of updating the existing instance, killing performance on real-time data.
- Angular: conflicts between the library's internal render loop and Angular's change detection / zone.js, plus memory leaks from missing cleanup (chart.destroy() not called), plus type-definition breakages across Angular version upgrades.

This project's differentiator: genuinely idiomatic, consistent bindings across frameworks, with proper lifecycle handling (mount, update, destroy) built into the architecture from day one rather than retrofitted.

## Architecture
Layered design, core engine has zero framework dependencies:

1. Framework Wrappers (thin layer) — React wrapper, Angular wrapper (Vue etc. later)
2. Public API — declarative config object (options-style), imperative methods (update, destroy)
3. Core Engine (vanilla TypeScript) — scale and axis calculation, layout engine, SVG rendering, animation, event system

Core principle: the engine must work correctly with zero knowledge that React or Angular exist. Framework packages only manage instantiation, updates on prop/input changes, and cleanup on unmount/destroy.

## Tech Stack
- Language: TypeScript throughout (core and wrappers)
- Rendering: SVG for v1 (crisp, stylable, accessible). Canvas/WebGL considered later for high-density data, not in scope for portfolio version.
- Core engine: no heavy dependencies; avoid bundling all of D3, borrow algorithmic ideas only if needed (scales, shapes)
- Build tooling: tsup or Rollup for producing ESM and CJS builds plus type declarations
- Monorepo: pnpm workspaces (Nx/Turborepo optional if project grows)
- Package structure:
  - core package — the rendering engine
  - react package — React wrapper
  - angular package — Angular wrapper
- React target: React 18+ (functional component, hooks-based; matches the StrictMode double-invoke handling already in scope)
- Angular target: latest stable major, standalone component (no NgModule) — simpler for consumers to adopt and avoids tying the wrapper's install story to a specific module setup. Pin the exact version once Day 5 starts; declare it as a `peerDependencies` range (not a regular dependency) in the angular package, same for react/react-dom in the react package.
- Linting/formatting: ESLint + Prettier, shared config at the workspace root so all three packages format consistently

## Config Object — What to Lock In Early

The config object is the contract both wrappers depend on. In TypeScript, adding a *new optional field* to it later is not a breaking change — existing consumers keep working. What breaks things is restructuring a field that already shipped (e.g. `tooltip: boolean` becoming `tooltip: { enabled, formatter }`). So the filter for "decide now" isn't "will we eventually need this" — almost everything eventually gets used — it's "do we know this field's shape well enough to not have to restructure it later." Applied across the full surface, not just color/tooltip/axis:

**Lock the shape now** (typed in `ChartConfig` / `SeriesConfig` from Day 1, most shipped with hardcoded defaults and no real behavior yet):
- `series` — array of `{ id, name, data, color?, visible? }`, plus a per-chart-type nested slot (`line?`, `bar?`, `pie?`) so chart-type-specific options (line curve/style, point markers, bar stacking/corner radius, pie inner radius/label position) have a home without fighting each other in one flat namespace
- `colors` — default palette array, plus per-series override
- `axis.x` / `axis.y` — **type first** (`category` / `linear` / `time` — this decides which scale math the engine uses, it's not a cosmetic option), then tick count, label formatter, gridlines toggle, axis title, min/max
- `tooltip` — enabled flag, `shared` (all series at hovered x, relevant once there's >1 series), formatter callback
- `legend` — enabled flag, position (top/bottom/left/right); if it exists at all it needs a position enum decided up front, since retrofitting "legend can now go on the side" after CSS is written for "always below the chart" is a real rework
- `title` — text + position
- `animation` — enabled flag, duration, easing
- `margin` — top/right/bottom/left (chart area vs. container — layout engine needs this concept from day one even if the default is fixed)
- **Event API shape, not just event fields** — decide whether the core instance exposes pub-sub methods (`chart.on('click', handler)` / `chart.off(...)`) versus callbacks only inside the config object. This is the piece the wrappers actually hinge on: a pub-sub core lets React map to props (`onDataPointClick`) and Angular map to `@Output() dataPointClick` from the exact same underlying mechanism, which is the "idiomatic in both frameworks" promise this project is built around. Deciding this after the render loop exists is expensive to retrofit.
- `series[].data` point shape — `{ x, y }` at minimum, plus whether it's generic (`data: T[]`) so a formatter/click handler can read caller-supplied metadata off a point. Cheap to decide now, awkward to widen later since it touches every chart-type renderer.
- `width` / `height` / responsive flag
- **`update(partialConfig)` semantics** — this is what "efficient update, no rebuild" actually means in code, so it can't stay implicit. Decide: `update()` takes a *partial* config and deep-merges it into the existing one (not a full replace), and the engine diffs old vs. new to decide the minimal action — new `data` on an existing series → repatch points and re-run enter/update/exit, not a full relayout; a changed `color` → restyle only; a changed chart `type` or added/removed series → full relayout. Without this decision made explicit, "lightweight diffing" (already flagged under Known Challenges) has no contract to diff against.
- **Empty / invalid data behavior** — what renders when `series` is `[]`, or a data point has `NaN`/`null`/missing values. Pick one now (e.g. render an empty-state placeholder for no data, skip/gap for individual bad points rather than throwing) so it's a designed behavior, not whatever happens to fall out of the scale math.

**Safe to add later as new optional fields** (genuinely additive, no restructuring risk, can wait until there's a real use case):
- secondary/multiple y-axes
- locale-aware number/date formatting defaults
- crosshair, zoom/pan
- legend item click-to-toggle-series behavior (the `legend` object exists already above; `onToggle` is just one more optional field on it)

**Explicitly deferred** (already listed under Future Enhancements below, and now also not silently missing from the schema conversation):
- Full CSS-variable/token-based theming system
- Rich tooltip HTML templates
- Per-element style overrides beyond color
- Accessibility (ARIA labels, data table fallback) — note as a known gap, not a decision that's been made and forgotten

## Scope for Portfolio Version (One Week Plan)

Day 1-2: Core engine
- Plain TypeScript, no framework code
- Line chart type first: data input, scale/axis calculation, SVG rendering, basic animation
- Clean declarative config object as the public API
- Update() and destroy() methods built in from the start

Day 3: Expand chart types
- Add bar chart and pie chart using the same core engine
- Confirms the architecture generalizes beyond one chart type

Day 4: React wrapper
- Thin component: container ref, instantiate core chart in an effect hook, update on prop changes, destroy on unmount
- Guard against React StrictMode double-invoke issues

Day 5: Angular wrapper
- Component using ElementRef and lifecycle hooks (ngOnChanges, ngOnDestroy)
- Careful handling of change detection / zone.js to avoid conflicts with the render loop
- Proper cleanup on destroy to avoid memory leaks

Day 6: Polish and demo page
- Single demo page showing all chart types rendered identically in both React and Angular side by side
- Basic responsive handling (ResizeObserver)
- **A live-update scenario is required, not optional** — e.g. a "push new data point" / "randomize data" button running on an interval, shown on both the React and Angular versions of the same chart. This is the only place in the whole project that actually demonstrates the core differentiator (update patches in place, no teardown/rebuild); without it, the case study is asserting the claim rather than showing it. Worth pairing with something visible in the browser (e.g. a DevTools recording, or simply pointing out via a counter that other elements on the page — like a running clock — keep animating smoothly through a chart update, which they wouldn't if the whole SVG were being torn down)

Day 7: Documentation and case study
- Short written case study: problem solved, why cross-framework consistency matters, code snippets
- README with setup instructions, architecture explanation, and screenshots/GIFs of the demo

## Testing Strategy
Not in the original day-by-day plan, but worth stating explicitly since the whole pitch is "clean architecture" — shipping untested scale/axis math undercuts that. Minimum bar for a portfolio version:
- Unit tests for the core engine's pure logic (scale calculation, tick generation, data-to-pixel mapping) — this is the highest bug-risk, easiest-to-test part of the whole project, and a natural thing to point to in the case study
- Skip DOM/snapshot testing of SVG output and wrapper integration tests — good to have, not worth the time inside a one-week scope
- Vitest is a reasonable default (fast, works cleanly in a TS monorepo without extra config)

## Known Challenges To Watch For
- Reactive updates without a framework: core engine needs its own lightweight diffing so updates are efficient regardless of what triggers them
- Framework lifecycle mismatches: React StrictMode double effects, Angular zone.js/change detection loops — both require careful cleanup logic
- SSR safety: guard any window/document access for future Next.js/Angular Universal compatibility (not required for v1 demo, but keep code SSR-safe where easy)
- Bundle size: keep core lean, avoid unnecessary dependencies
- Accessibility: not required for v1 portfolio scope, but note as a future improvement area (ARIA labels, accessible data table fallback)
- API longevity: keep the config object structure clean and consistent since it is the contract both wrappers depend on

## Future Enhancements (Post-Portfolio, Not in Week-1 Scope)
- Canvas/WebGL rendering mode for large datasets
- Additional chart types (scatter, area, candlestick)
- Vue wrapper
- Real-time streaming data support with batched/throttled updates
- Accessibility pass (ARIA, keyboard navigation, data table fallback)
- Theming system via CSS variables or token-based config


## Open Decisions (need your input, not something to silently default)
- **Library name** — ~~still TBD~~ **resolved: SulaCharts.** Decided after Day 7 rather than before Day 0 as this section originally recommended — retrofitting the name into every package, import path, config file, and doc afterward (rather than settling it early) was the actual cost of deferring this, exactly as anticipated below. `@sulacharts/*` scope, `<sula-chart>` Angular selector.
- **Where the case study gets published** — the goal is an Upwork portfolio piece, but the brief doesn't say whether the case study lives in the repo README, a separate blog post/Medium article, or gets attached directly to an Upwork profile/proposal. Affects how much the Day 7 writeup should stand alone vs. link back to the repo.

## Repository Folder Structure

Monorepo layout using pnpm workspaces:

repo-root
  packages
    core             (the rendering engine, framework-agnostic)
      src
      package.json
    react            (React wrapper package)
      src
      package.json
    angular          (Angular wrapper package)
      src
      package.json
  apps
    demo             (demo site showing React and Angular usage side by side)
  package.json       (workspace root)
  pnpm-workspace.yaml
  README.md
  tsconfig.base.json

Each package under packages has its own package.json, its own build output, and can be published independently. The demo app under apps consumes core, react, and angular packages locally via the workspace, so changes are reflected immediately during development.

## Publishing the Library (npm)

Steps to publish the packages so others can install them:

0. License: add a LICENSE file at the repo root (MIT is the standard default for a portfolio/open-source library) and a matching `license` field in each package.json — npm flags packages with no license, which is a bad first impression on a page meant to build credibility.

1. Naming: pick a scoped npm name to avoid collisions, for example at-yourname-slash-core, at-yourname-slash-react, at-yourname-slash-angular. Scoped names are free on npm for public packages.

2. Build before publish: each package should have a build script that outputs both ESM and CJS formats plus TypeScript type declaration files, so it works whether a consumer uses import or require.

3. package.json fields: each package needs a clear main and module field pointing to build output, a types field for the declaration file, and a files field listing exactly which folders to include so the published package doesn't ship source or test files.

4. Versioning: use semantic versioning. Start all packages at zero point one point zero while unstable. Consider a tool like Changesets to manage version bumps and changelogs across multiple packages in the monorepo cleanly.

5. npm account and login: create an npm account if you don't have one, then run npm login locally.

6. Publish command: from each package folder, run npm publish with the access flag set to public, since scoped packages default to private otherwise.

7. Dependency between packages: the react and angular packages should list core as a normal dependency with a version range, so installing react or angular automatically pulls in the matching core version.

8. Continuous publishing later: once the project is stable, a GitHub Actions workflow can automate publishing on merge to main or on tagged releases, but for the portfolio version manual publishing is fine.

9. README per package: each published package should have its own short README with install instructions and a minimal usage example, since that is what people see on the npm package page.

This publishing step is optional for the portfolio case study itself, but actually publishing even a zero point one version to npm and linking it live is a strong credibility signal for a client browsing the portfolio.
