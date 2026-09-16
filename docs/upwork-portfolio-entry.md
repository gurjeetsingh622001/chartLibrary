# Upwork Portfolio Entry — SulaCharts

Copy-paste source for the "Add a new portfolio project" form. Field limits noted are Upwork's own.

## Project title
SulaCharts — A Cross-Framework Chart Library for React & Angular

## Your role (100 chars max)
Solo developer — architected the core engine, wrappers, tests, docs, and shipped it to npm.

## Project description (600 chars max)
Most chart libraries bolt React/Angular support onto a vanilla-JS core as an afterthought, causing real bugs: full re-renders on data updates, or broken change detection. I built SulaCharts to fix this at the architecture level: a dependency-free SVG engine (line/bar/pie) with a small imperative API, wrapped by thin React and Angular bindings that patch the DOM in place instead of rebuilding it. Verified by running the published npm package in a real browser, which caught two bugs unit tests missed — one specific to Angular DI under esbuild. 81 automated tests; full case study included.

## Skills and deliverables (5 max)
- TypeScript
- React
- Angular
- Data Visualization
- npm Package Development

## Links to attach
- npm: https://www.npmjs.com/package/@sulacharts/core
- Case study: [docs/CASE_STUDY.md](CASE_STUDY.md)
- Repo: (add your GitHub remote URL once pushed)
