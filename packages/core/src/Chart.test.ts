/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Chart } from './Chart';
import type { ChartConfig } from './types';

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function lineConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    type: 'line',
    animation: { enabled: false },
    series: [
      {
        id: 's1',
        name: 'Series 1',
        data: [
          { x: 'Jan', y: 1 },
          { x: 'Feb', y: 5 },
          { x: 'Mar', y: 3 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Chart', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  it('renders one <path> per series', () => {
    const chart = new Chart(container, lineConfig());
    expect(container.querySelectorAll('path').length).toBe(1);
    chart.destroy();
  });

  it('renders a "No data" placeholder for an empty series', () => {
    const chart = new Chart(container, lineConfig({ series: [{ id: 's1', name: 'S1', data: [] }] }));
    expect(container.textContent).toContain('No data');
    expect(container.querySelectorAll('path').length).toBe(0);
    chart.destroy();
  });

  it('skips invalid points instead of throwing', () => {
    const config = lineConfig({
      series: [
        {
          id: 's1',
          name: 'S1',
          data: [
            { x: 'Jan', y: 1 },
            { x: 'Feb', y: NaN },
            { x: 'Mar', y: 3 },
          ],
        },
      ],
    });
    expect(() => new Chart(container, config)).not.toThrow();
    expect(container.querySelectorAll('circle').length).toBe(2);
  });

  it('update() with only new data values patches the same <svg> and <path> nodes in place instead of rebuilding', () => {
    const chart = new Chart(container, lineConfig());
    const svgBefore = container.querySelector('svg');
    const pathBefore = container.querySelector('path');
    const dBefore = pathBefore?.getAttribute('d');

    chart.update({
      series: [
        {
          id: 's1',
          name: 'Series 1',
          // Deliberately not a uniform scalar multiple of the original
          // [1, 5, 3] shape — a proportional rescale can land on identical
          // normalized pixel positions once the y-axis auto-scales, which
          // would make this assertion pass for the wrong reason.
          data: [
            { x: 'Jan', y: 4 },
            { x: 'Feb', y: 4 },
            { x: 'Mar', y: 9 },
          ],
        },
      ],
    });

    const svgAfter = container.querySelector('svg');
    const pathAfter = container.querySelector('path');

    expect(svgAfter).toBe(svgBefore);
    expect(pathAfter).toBe(pathBefore);
    expect(pathAfter?.getAttribute('d')).not.toBe(dBefore);
    chart.destroy();
  });

  it('update() that adds a series rebuilds (structural change)', () => {
    const chart = new Chart(container, lineConfig());
    const svgBefore = container.querySelector('svg');

    chart.update({
      series: [
        { id: 's1', name: 'Series 1', data: [{ x: 'Jan', y: 1 }] },
        { id: 's2', name: 'Series 2', data: [{ x: 'Jan', y: 2 }] },
      ],
    });

    expect(container.querySelectorAll('path').length).toBe(2);
    expect(container.querySelector('svg')).not.toBe(svgBefore);
    chart.destroy();
  });

  it('toggling a series visible=false hides its whole series group without removing DOM nodes', () => {
    const chart = new Chart(container, lineConfig());
    const groupBefore = container.querySelector('g.chart-series');
    const pathBefore = container.querySelector('path');

    chart.update({ series: [{ id: 's1', name: 'Series 1', data: lineConfig().series[0]!.data, visible: false }] });

    const groupAfter = container.querySelector('g.chart-series');
    expect(groupAfter).toBe(groupBefore);
    expect(container.querySelector('path')).toBe(pathBefore);
    expect((groupAfter as SVGGElement).style.display).toBe('none');
    chart.destroy();
  });

  it('emits a click event with the data point and series when a point is clicked', () => {
    const chart = new Chart(container, lineConfig());
    const handler = vi.fn();
    chart.on('click', handler);

    const circle = container.querySelector('circle')!;
    circle.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].series.id).toBe('s1');
    chart.destroy();
  });

  it('off() stops a previously registered handler from firing', () => {
    const chart = new Chart(container, lineConfig());
    const handler = vi.fn();
    chart.on('click', handler);
    chart.off('click', handler);

    container.querySelector('circle')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });

  it('destroy() empties the container', () => {
    const chart = new Chart(container, lineConfig());
    chart.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('uses a custom tooltip formatter over the default text', () => {
    const formatter = vi.fn(() => 'custom tooltip');
    const chart = new Chart(container, lineConfig({ tooltip: { formatter } }));
    const circle = container.querySelector('circle')!;
    circle.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    expect(formatter).toHaveBeenCalled();
    chart.destroy();
  });
});

describe('Chart (bar)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  function barConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
    return {
      type: 'bar',
      animation: { enabled: false },
      series: [
        { id: 's1', name: 'Series 1', data: [{ x: 'A', y: 5 }, { x: 'B', y: 3 }] },
        { id: 's2', name: 'Series 2', data: [{ x: 'A', y: 2 }, { x: 'B', y: 7 }] },
      ],
      ...overrides,
    };
  }

  it('renders one <rect> per data point across series (grouped by default)', () => {
    const chart = new Chart(container, barConfig());
    expect(container.querySelectorAll('rect').length).toBe(4);
    chart.destroy();
  });

  it('sizes the y-axis to the summed stack height when series are marked stacked', () => {
    const chart = new Chart(
      container,
      barConfig({
        series: [
          { id: 's1', name: 'Series 1', data: [{ x: 'A', y: 5 }], bar: { stacked: true } },
          { id: 's2', name: 'Series 2', data: [{ x: 'A', y: 5 }], bar: { stacked: true } },
        ],
      }),
    );
    // A grouped layout would top out around 5; stacked should reach 10.
    expect(container.textContent).toContain('10');
    chart.destroy();
  });

  it('keeps the same series <g> wrapper across a data-only update', () => {
    const chart = new Chart(container, barConfig());
    const groupBefore = container.querySelectorAll('g.chart-series')[0];

    chart.update({
      series: [
        { id: 's1', name: 'Series 1', data: [{ x: 'A', y: 9 }, { x: 'B', y: 1 }] },
        { id: 's2', name: 'Series 2', data: [{ x: 'A', y: 2 }, { x: 'B', y: 7 }] },
      ],
    });

    const groupAfter = container.querySelectorAll('g.chart-series')[0];
    expect(groupAfter).toBe(groupBefore);
    chart.destroy();
  });

  it('emits a click event with the data point and series when a bar is clicked', () => {
    const chart = new Chart(container, barConfig());
    const handler = vi.fn();
    chart.on('click', handler);

    container.querySelector('rect')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    chart.destroy();
  });
});

describe('Chart (pie)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  function pieConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
    return {
      type: 'pie',
      animation: { enabled: false },
      series: [
        {
          id: 's1',
          name: 'Distribution',
          data: [
            { x: 'A', y: 30 },
            { x: 'B', y: 70 },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('renders one <path> slice per data point', () => {
    const chart = new Chart(container, pieConfig());
    expect(container.querySelectorAll('path').length).toBe(2);
    chart.destroy();
  });

  it('renders a "No data" placeholder when every value is zero or negative', () => {
    const chart = new Chart(
      container,
      pieConfig({ series: [{ id: 's1', name: 'Distribution', data: [{ x: 'A', y: 0 }] }] }),
    );
    expect(container.textContent).toContain('No data');
    chart.destroy();
  });

  it('keeps existing slice <path> nodes and adds a new one when a category is added (non-structural update)', () => {
    const chart = new Chart(container, pieConfig());
    const paths = container.querySelectorAll('path');
    const pathA = paths[0];
    const pathB = paths[1];

    chart.update({
      series: [
        {
          id: 's1',
          name: 'Distribution',
          data: [
            { x: 'A', y: 30 },
            { x: 'B', y: 50 },
            { x: 'C', y: 20 },
          ],
        },
      ],
    });

    const pathsAfter = container.querySelectorAll('path');
    expect(pathsAfter.length).toBe(3);
    expect(Array.from(pathsAfter)).toContain(pathA);
    expect(Array.from(pathsAfter)).toContain(pathB);
    chart.destroy();
  });

  it('removes a slice <path> when its category disappears from the data', () => {
    const chart = new Chart(container, pieConfig());
    chart.update({
      series: [{ id: 's1', name: 'Distribution', data: [{ x: 'A', y: 100 }] }],
    });
    expect(container.querySelectorAll('path').length).toBe(1);
    chart.destroy();
  });

  it('emits a click event with the slice data point when clicked', () => {
    const chart = new Chart(container, pieConfig());
    const handler = vi.fn();
    chart.on('click', handler);

    container.querySelector('path')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].point.x).toBe('A');
    chart.destroy();
  });

  it('renders one legend item per slice when the legend is enabled', () => {
    const chart = new Chart(container, pieConfig({ legend: { enabled: true } }));
    expect(container.querySelectorAll('.chart-legend text').length).toBe(2);
    chart.destroy();
  });
});
