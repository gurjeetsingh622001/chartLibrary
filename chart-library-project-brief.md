# Cross-Framework Chart Library — Project Brief

## Goal
Build a lightweight, framework-agnostic charting library (working name: TBD) as an Upwork portfolio project. The library's core rendering engine is written in plain TypeScript and rendered as SVG, with thin, idiomatic wrapper packages for React and Angular. The goal is not to compete with Highcharts/ECharts on feature breadth, but to demonstrate strong architecture, cross-framework compatibility, and clean rendering code as a portfolio piece.

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

Day 7: Documentation and case study
- Short written case study: problem solved, why cross-framework consistency matters, code snippets
- README with setup instructions, architecture explanation, and screenshots/GIFs of the demo

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
