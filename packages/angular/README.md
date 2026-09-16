# @sulacharts/angular

Angular wrapper for [`@sulacharts/core`](../core) — a standalone `ChartComponent`. See the [project README](../../README.md) and [case study](../../docs/CASE_STUDY.md), which covers the zone.js handling this package exists to get right.

**Not published to npm — held back deliberately.** This package builds with `tsup`/esbuild rather than `ng-packagr`, which real Angular libraries need for proper Ivy partial-compilation output. Confirmed concretely (not just theorized): the built package requires the consuming app to have `@angular/compiler` loaded at runtime, which a typical Angular CLI production (AOT) build strips out by default — so as published today, this would likely fail in a standard production Angular app. `@sulacharts/core` and `@sulacharts/react` don't have this problem and are published; this one is tracked in [PROGRESS.md](../../PROGRESS.md) pending the `ng-packagr` migration. It does work when consumed within this repo's own pnpm workspace (as `apps/demo` does), which is a different, weaker bar.

## Install (once published)

```
pnpm add @sulacharts/angular @sulacharts/core
```

Peer dependency: `@angular/core` `>=18.0.0`.

## Usage

```ts
import { Component } from '@angular/core';
import { ChartComponent } from '@sulacharts/angular';
import type { ChartConfig } from '@sulacharts/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ChartComponent],
  template: `
    <sula-chart [config]="config" (dataPointClick)="onClick($event)"></sula-chart>
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
