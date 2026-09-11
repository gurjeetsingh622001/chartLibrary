import { describe, expect, it, vi } from 'vitest';
import { Chart } from './Chart';
import type { ChartConfig } from './types';

function createContainer(): HTMLElement {
  return { innerHTML: '' } as unknown as HTMLElement;
}

describe('Chart', () => {
  it('constructs, updates, and destroys without throwing', () => {
    const config: ChartConfig = {
      type: 'line',
      series: [{ id: 's1', name: 'Series 1', data: [{ x: 0, y: 1 }] }],
    };
    const chart = new Chart(createContainer(), config);
    expect(() => chart.update({ colors: ['#000'] })).not.toThrow();
    expect(() => chart.destroy()).not.toThrow();
  });

  it('registers and unregisters event listeners without throwing', () => {
    const chart = new Chart(createContainer(), { type: 'line', series: [] });
    const handler = vi.fn();
    chart.on('click', handler);
    chart.off('click', handler);
    chart.destroy();
  });
});
