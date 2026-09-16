# @chart-lib/angular *(placeholder name)*

Angular wrapper for [`@chart-lib/core`](../core) — a standalone `ChartComponent`. See the [project README](../../README.md) and [case study](../../docs/CASE_STUDY.md), which covers the zone.js handling this package exists to get right.

Not published to npm yet — see [Open Decisions](../../chart-library-project-brief.md#open-decisions-need-your-input-not-something-to-silently-default) in the project brief. **Also not npm-publish-ready as built**: this package currently builds with `tsup`/esbuild rather than `ng-packagr`, which a real Angular library needs for proper Ivy partial-compilation output. It works when consumed within this repo's own pnpm workspace (as `apps/demo` does) — see [PROGRESS.md](../../PROGRESS.md) (Day 5/6) for what that gap did and didn't affect.

## Install

```
pnpm add @chart-lib/angular @chart-lib/core
```

Peer dependency: `@angular/core` `>=18.0.0`.

## Usage

```ts
import { Component } from '@angular/core';
import { ChartComponent } from '@chart-lib/angular';
import type { ChartConfig } from '@chart-lib/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ChartComponent],
  template: `
    <chart-lib [config]="config" (dataPointClick)="onClick($event)"></chart-lib>
  `,
})
export class DashboardComponent {
  config: ChartConfig = {
    type: 'line',
    title: { text: 'Monthly Revenue' },
    series: [{ id: 'revenue', name: 'Revenue', data: [{ x: 'Jan', y: 42 }, { x: 'Feb', y: 58 }] }],
  };

  onClick(event: { point: unknown; series: unknown }) {
    console.log(event);
  }
}
```

Reassigning `config` calls `chart.update()` on the existing instance via `ngOnChanges` — it does not tear down and recreate the chart. All of the chart's internal DOM/event work runs inside `NgZone.runOutsideAngular()`, so it doesn't trigger spurious change-detection cycles; only the `dataPointClick`/`dataPointHover` outputs re-enter the zone.

## Inputs / Outputs

- `[config]: ChartConfig` — required.
- `(dataPointClick)`, `(dataPointHover)` — mapped onto the core engine's `on('click', ...)`/`on('hover', ...)`.

The component uses its own host element as the chart container — no need to wrap it in an extra `<div>`.
