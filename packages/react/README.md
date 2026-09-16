# @chart-lib/react *(placeholder name)*

React wrapper for [`@chart-lib/core`](../core) — a thin `<Chart>` component that only manages instantiation, patching on prop changes, and cleanup. All rendering logic lives in the core engine. See the [project README](../../README.md) and [case study](../../docs/CASE_STUDY.md).

Not published to npm yet — see [Open Decisions](../../chart-library-project-brief.md#open-decisions-need-your-input-not-something-to-silently-default) in the project brief.

## Install

```
pnpm add @chart-lib/react @chart-lib/core
```

Peer dependencies: `react` and `react-dom` `^18.0.0`.

## Usage

```tsx
import { useState } from 'react';
import { Chart } from '@chart-lib/react';
import type { ChartConfig } from '@chart-lib/core';

const config: ChartConfig = {
  type: 'line',
  title: { text: 'Monthly Revenue' },
  series: [
    { id: 'revenue', name: 'Revenue', data: [{ x: 'Jan', y: 42 }, { x: 'Feb', y: 58 }] },
  ],
};

function Dashboard() {
  const [data, setData] = useState(config);
  return (
    <Chart
      config={data}
      onDataPointClick={({ point, series }) => console.log(point, series)}
      onDataPointHover={({ point }) => console.log('hover', point)}
    />
  );
}
```

Changing the `config` prop calls `chart.update()` on the existing instance — it does not tear down and remount the chart. Safe under `<StrictMode>`: the mount effect is idempotent (see the [case study](../../docs/CASE_STUDY.md) for why that didn't need a guard flag).

## Props

- `config: ChartConfig` — required.
- `className?`, `style?` — applied to the wrapping `<div>`.
- `onDataPointClick?`, `onDataPointHover?` — mapped onto the core engine's `on('click', ...)`/`on('hover', ...)`.
