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

  it('toggling a series visible=false hides it without removing its DOM nodes', () => {
    const chart = new Chart(container, lineConfig());
    const pathBefore = container.querySelector('path');

    chart.update({ series: [{ id: 's1', name: 'Series 1', data: lineConfig().series[0]!.data, visible: false }] });

    const pathAfter = container.querySelector('path');
    expect(pathAfter).toBe(pathBefore);
    expect((pathAfter as SVGPathElement).style.display).toBe('none');
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
