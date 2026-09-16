import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartConfig } from '@chart-lib/core';
import { Chart } from './Chart';

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
        ],
      },
    ],
    ...overrides,
  };
}

describe('Chart (React)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('mounts exactly one chart', () => {
    act(() => {
      root.render(<Chart config={lineConfig()} />);
    });
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(container.querySelectorAll('path').length).toBe(1);
  });

  it('does not duplicate or drop the chart under StrictMode double-invoke', () => {
    act(() => {
      root.render(
        <StrictMode>
          <Chart config={lineConfig()} />
        </StrictMode>,
      );
    });
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(container.querySelectorAll('path').length).toBe(1);
  });

  it('patches the same <svg>/<path> nodes in place when the config prop changes', () => {
    act(() => {
      root.render(<Chart config={lineConfig()} />);
    });
    const svgBefore = container.querySelector('svg');
    const pathBefore = container.querySelector('path');

    act(() => {
      root.render(
        <Chart
          config={lineConfig({
            series: [
              {
                id: 's1',
                name: 'Series 1',
                data: [
                  { x: 'Jan', y: 8 },
                  { x: 'Feb', y: 2 },
                ],
              },
            ],
          })}
        />,
      );
    });

    expect(container.querySelector('svg')).toBe(svgBefore);
    expect(container.querySelector('path')).toBe(pathBefore);
  });

  it('rebuilds when a series is structurally added', () => {
    act(() => {
      root.render(<Chart config={lineConfig()} />);
    });
    act(() => {
      root.render(
        <Chart
          config={lineConfig({
            series: [
              { id: 's1', name: 'Series 1', data: [{ x: 'Jan', y: 1 }] },
              { id: 's2', name: 'Series 2', data: [{ x: 'Jan', y: 2 }] },
            ],
          })}
        />,
      );
    });
    expect(container.querySelectorAll('path').length).toBe(2);
  });

  it('destroys the chart (clears the container) on unmount', () => {
    act(() => {
      root.render(<Chart config={lineConfig()} />);
    });
    expect(container.querySelector('svg')).not.toBeNull();
    act(() => {
      root.unmount();
    });
    expect(container.innerHTML).toBe('');
  });

  it('wires onDataPointClick to the core click event', () => {
    const handler = vi.fn();
    act(() => {
      root.render(<Chart config={lineConfig()} onDataPointClick={handler} />);
    });
    act(() => {
      container.querySelector('circle')!.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].series.id).toBe('s1');
  });

  it('wires onDataPointHover to the core hover event', () => {
    const handler = vi.fn();
    act(() => {
      root.render(<Chart config={lineConfig()} onDataPointHover={handler} />);
    });
    act(() => {
      container.querySelector('circle')!.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops calling a removed onDataPointClick handler after a re-render without it', () => {
    const handler = vi.fn();
    const config = lineConfig();
    act(() => {
      root.render(<Chart config={config} onDataPointClick={handler} />);
    });
    act(() => {
      root.render(<Chart config={config} />);
    });
    act(() => {
      container.querySelector('circle')!.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
