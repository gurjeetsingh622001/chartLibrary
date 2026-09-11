# Demo app (placeholder)

Scheduled for Day 6 — see [PROGRESS.md](../../PROGRESS.md). Depends on `packages/core` (Day 1-3) and both wrappers (Day 4-5) existing first, so it's intentionally empty for now.

Still open when this gets built: how React and Angular get mounted on the same demo page. Mounting both frameworks simultaneously in one app has real complexity (bundler config, Angular's zone.js patching globals that React's event handling also touches) — worth deciding then whether that's a single page with two mount points, or two routes/two separate mini-apps linked from one index. Must include a live-update scenario (see the "Day 6" note in the project brief) — that's what actually demonstrates the update-without-rebuild differentiator, not just static side-by-side rendering.
