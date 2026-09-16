/** @vitest-environment happy-dom */
import type { NgZone } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { ChartConfig } from '@chart-lib/core';
import { ChartComponent } from './chart.component';

// A real NgZone requires zone.js loaded globally, which would pull a
// fairly heavy dependency into this package's test setup just to verify
// plumbing that doesn't actually depend on zone.js's real scheduling
// behavior — only on run()/runOutsideAngular() being called with the right
// function at the right time. A fake that just invokes the callback
// synchronously is enough to assert that, and lets these tests construct
// the component directly instead of going through Angular's TestBed.
class FakeNgZone {
  runOutsideAngular<R>(fn: () => R): R {
    return fn();
  }
  run<R>(fn: () => R): R {
    return fn();
  }
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
        ],
      },
    ],
    ...overrides,
  };
}

// Minimal local alias so this file doesn't need @angular/core's ElementRef
// type import just for a test-local cast.
type ElementRef<T> = { nativeElement: T };

function createComponent(config: ChartConfig, platform: 'browser' | 'server' = 'browser') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const elementRef = { nativeElement: el } as ElementRef<HTMLElement>;
  const ngZone = new FakeNgZone() as unknown as NgZone;
  const component = new ChartComponent(elementRef, ngZone, platform);
  component.config = config;
  return { component, el, ngZone };
}

describe('ChartComponent', () => {
  it('creates the chart on ngAfterViewInit using the host element as the container', () => {
    const { component, el } = createComponent(lineConfig());
    component.ngAfterViewInit();
    expect(el.querySelectorAll('svg').length).toBe(1);
  });

  it('does nothing on the server platform (SSR guard)', () => {
    const { component, el } = createComponent(lineConfig(), 'server');
    component.ngAfterViewInit();
    expect(el.querySelectorAll('svg').length).toBe(0);
  });

  it('runs chart creation inside ngZone.runOutsideAngular, not the default zone', () => {
    const { component, ngZone } = createComponent(lineConfig());
    const spy = vi.spyOn(ngZone, 'runOutsideAngular');
    component.ngAfterViewInit();
    expect(spy).toHaveBeenCalled();
  });

  it('ignores ngOnChanges before the chart exists (the initial input binding)', () => {
    const { component } = createComponent(lineConfig());
    expect(() => component.ngOnChanges({ config: {} as never })).not.toThrow();
  });

  it('patches the same <svg> node in place on ngOnChanges once the chart exists', () => {
    const { component, el } = createComponent(lineConfig());
    component.ngAfterViewInit();
    const svgBefore = el.querySelector('svg');

    component.config = lineConfig({
      series: [
        {
          id: 's1',
          name: 'Series 1',
          data: [
            { x: 'Jan', y: 9 },
            { x: 'Feb', y: 2 },
          ],
        },
      ],
    });
    component.ngOnChanges({ config: {} as never });

    expect(el.querySelector('svg')).toBe(svgBefore);
  });

  it('ignores ngOnChanges calls that do not include a config change', () => {
    const { component } = createComponent(lineConfig());
    component.ngAfterViewInit();
    const updateSpy = vi.spyOn(component['chart']!, 'update');
    component.ngOnChanges({});
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('destroys the chart and clears the host element on ngOnDestroy', () => {
    const { component, el } = createComponent(lineConfig());
    component.ngAfterViewInit();
    component.ngOnDestroy();
    expect(el.innerHTML).toBe('');
  });

  it('emits dataPointClick inside ngZone.run when a point is clicked', () => {
    const { component, el, ngZone } = createComponent(lineConfig());
    const runSpy = vi.spyOn(ngZone, 'run');
    component.ngAfterViewInit();

    const handler = vi.fn();
    component.dataPointClick.subscribe(handler);
    el.querySelector('circle')!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalled();
  });

  it('emits dataPointHover when a point is hovered', () => {
    const { component, el } = createComponent(lineConfig());
    component.ngAfterViewInit();

    const handler = vi.fn();
    component.dataPointHover.subscribe(handler);
    el.querySelector('circle')!.dispatchEvent(new Event('mouseenter', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
