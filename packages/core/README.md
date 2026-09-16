# @sulacharts/core

Framework-agnostic SVG charting engine — line, bar (grouped/stacked), and pie/donut charts, with no dependency on React, Angular, or anything else. See the [project README](../../README.md) and [case study](../../docs/CASE_STUDY.md) for the full story.

Not published to npm yet.

## Install

```
pnpm add @sulacharts/core
```

(Once published — for now, consume it via the pnpm workspace, as `packages/react`, `packages/angular`, and `apps/demo` all do.)

## Usage

```ts
import { Chart } from '@sulacharts/core';

const container = document.getElementById('chart')!;

const chart = new Chart(container, {
  type: 'line',
  title: { text: 'Monthly Revenue' },
  legend: { enabled: true },
  series: [
    {
      id: 'revenue',
      name: 'Revenue',
      data: [
        { x: 'Jan', y: 42 },
        { x: 'Feb', y: 58 },
        { x: 'Mar', y: 51 },
      ],
    },
  ],
});

// Later — patches the existing DOM in place, doesn't rebuild:
chart.update({ series: [{ id: 'revenue', name: 'Revenue', data: [/* new points */] }] });

// Click/hover events:
chart.on('click', ({ point, series }) => console.log(point, series));

// Cleanup:
chart.destroy();
```

## API

- `new Chart(container: HTMLElement, config: ChartConfig)` — mounts immediately.
- `chart.update(partialConfig: ChartConfigUpdate)` — deep-merges into the current config. Structural changes (series added/removed/reordered, `type` changed) trigger a full rebuild; everything else patches existing DOM nodes in place.
- `chart.destroy()` — clears the container and all internal listeners.
- `chart.on(event, handler)` / `chart.off(event, handler)` — `'click'` and `'hover'`, each firing with `{ point, series }`.

`ChartConfig` covers `type` (`'line' | 'bar' | 'pie'`), `series`, `colors`, `axis.x`/`axis.y` (type/ticks/labels/gridlines/min/max), `tooltip`, `legend`, `title`, `animation`, `margin`, `width`/`height`, and `responsive` (opts into `ResizeObserver`-based auto-sizing when no fixed width/height is set). See `src/types.ts` for the full shape — every field is documented there with the reasoning behind its shape in the project brief's "Config Object" section.
