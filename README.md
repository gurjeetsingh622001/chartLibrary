# Chart Library (working name — see [Open Decisions](chart-library-project-brief.md#open-decisions-need-your-input-not-something-to-silently-default))

Framework-agnostic SVG charting engine with idiomatic React and Angular wrappers. See [chart-library-project-brief.md](chart-library-project-brief.md) for the full architecture and scope, and [PROGRESS.md](PROGRESS.md) for day-by-day status.

This is a working README for development; the polished version with the case study, screenshots, and usage examples is Day 7 scope.

## Setup

```
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Structure

- `packages/core` — the rendering engine (framework-agnostic)
- `packages/react` — React wrapper (placeholder until Day 4)
- `packages/angular` — Angular wrapper (placeholder until Day 5)
- `apps/demo` — demo app (placeholder until Day 6)
