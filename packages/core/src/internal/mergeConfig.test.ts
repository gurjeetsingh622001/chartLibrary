import { describe, expect, it } from 'vitest';
import { mergeChartConfig } from './mergeConfig';
import type { ChartConfig } from '../types';

function baseConfig(): ChartConfig {
  return {
    type: 'line',
    series: [{ id: 's1', name: 'Series 1', data: [{ x: 0, y: 1 }] }],
    axis: { x: { type: 'category' }, y: { gridlines: true } },
    tooltip: { enabled: true },
  };
}

describe('mergeChartConfig', () => {
  it('replaces top-level primitive fields', () => {
    const merged = mergeChartConfig(baseConfig(), { width: 500 });
    expect(merged.width).toBe(500);
  });

  it('merges nested axis config one level deep instead of wiping the untouched axis', () => {
    const merged = mergeChartConfig(baseConfig(), { axis: { x: { tickCount: 3 } } });
    expect(merged.axis?.x?.tickCount).toBe(3);
    expect(merged.axis?.x?.type).toBe('category');
    expect(merged.axis?.y?.gridlines).toBe(true);
  });

  it('merges nested tooltip config without dropping unrelated tooltip fields', () => {
    const merged = mergeChartConfig(baseConfig(), { tooltip: { shared: true } });
    expect(merged.tooltip?.shared).toBe(true);
    expect(merged.tooltip?.enabled).toBe(true);
  });

  it('replaces the series array wholesale rather than merging by index', () => {
    const newSeries = [{ id: 's2', name: 'Series 2', data: [{ x: 0, y: 9 }] }];
    const merged = mergeChartConfig(baseConfig(), { series: newSeries });
    expect(merged.series).toBe(newSeries);
  });

  it('leaves fields untouched by the patch unchanged', () => {
    const base = baseConfig();
    const merged = mergeChartConfig(base, { width: 400 });
    expect(merged.type).toBe('line');
    expect(merged.series).toBe(base.series);
  });
});
