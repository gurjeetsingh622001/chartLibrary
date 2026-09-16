# Building a chart library where React and Angular aren't an afterthought

*A portfolio project. Working name pending — see [README](../README.md).*

## The problem

Highcharts, ECharts, Chart.js, Nivo, Recharts, Visx, ApexCharts — the charting space is mature and well-served. But a pattern shows up consistently across GitHub issues and developer forums for libraries that bolt framework support onto a vanilla-JS core after the fact:

- React wrappers that call the library's `init()` on every render instead of `update()`, so a chart tied to live data tears down and rebuilds on every tick — fine for a static dashboard, unusable for anything real-time.
- Angular wrappers that fight `zone.js`: the library's internal render loop and Angular's change detection weren't designed with each other in mind, so you get either missed updates or a change-detection cycle firing on every mouse move over the chart.
- Cleanup that's an afterthought — `chart.destroy()` never called on unmount, listeners left attached, memory leaking in any app that mounts and unmounts charts (which is most real apps).

None of these are hard problems individually. They're symptoms of the same root cause: the framework binding was written after the core engine, as a thin shim reacting to whatever the core happened to expose, rather than as a first-class part of the architecture.

## The approach

Build the framework bindings *into* the architecture from day one, not after:

```
packages/core     zero framework dependencies — scales, axes, SVG rendering, animation, events
packages/react    mount/update/destroy lifecycle glue
packages/angular  same lifecycle glue, plus zone.js-aware event handling
```

The core exposes exactly four operations: construct, `update(partialConfig)`, `destroy()`, and `on`/`off` for events. Nothing about React or Angular leaks into it — no synthetic event system, no Angular decorators, nothing. Both wrappers are built entirely on that surface, which forces the core to actually be capable of everything a real wrapper needs (efficient partial updates, a real event system) rather than growing those features reactively once a wrapper needed them and didn't have them.

## `update()` is the whole point

The core differentiator isn't "renders three chart types" — it's that a data update doesn't tear the chart down:

```ts
// packages/core/src/Chart.ts
update(partial: ChartConfigUpdate<T>): void {
  const next = mergeChartConfig(this.config, partial);
  const structural = !this.mounted || this.isStructuralChange(this.config, next);
  this.config = next;
  if (structural) {
    this.renderFull();
  } else {
    this.patch();
  }
  this.syncResizeObserver();
}
```

`update()` takes a *partial* config and deep-merges it into the current one — so a caller passing just `{ series: newData }` doesn't need to reconstruct axis/tooltip/legend config it never touched. The engine then classifies the change: **structural** (series added/removed/reordered, chart type changed) triggers a full rebuild, since the DOM shape genuinely has to change. Everything else — new data values, a color change, a container resize — goes through `patch()`, which updates the existing `<svg>`, `<path>`, and `<rect>` elements' attributes directly rather than clearing and recreating them.

This is proven with reference-equality tests, not just asserted:

```ts
it('update() with only new data values patches the same <svg> and <path> nodes in place instead of rebuilding', () => {
  const chart = new Chart(container, lineConfig());
  const pathBefore = container.querySelector('path');
  chart.update({ series: [/* new data */] });
  expect(container.querySelector('path')).toBe(pathBefore); // same node, not a new one
});
```

...and again live, in the [demo](../apps/demo) — each side reads its own rendered `<svg>` node before and after a randomized update and reports on-page whether it's the same node.

## The Angular-specific problem: zone.js

React's effect-based lifecycle is a reasonably close match for "do imperative DOM work on mount, clean it up on unmount." Angular needed real thought, because `zone.js` globally monkey-patches `addEventListener` and `requestAnimationFrame` — which means every chart hover, click, and mount-fade animation frame would, by default, trigger a full Angular change-detection pass across the whole app:

```ts
// packages/angular/src/chart.component.ts
ngAfterViewInit(): void {
  if (!this.isBrowser) return;
  this.ngZone.runOutsideAngular(() => {
    const chart = new CoreChart<T>(this.elementRef.nativeElement, this.config);
    chart.on('click', (payload) => this.ngZone.run(() => this.dataPointClick.emit(payload)));
    chart.on('hover', (payload) => this.ngZone.run(() => this.dataPointHover.emit(payload)));
    this.chart = chart;
  });
}
```

All of the core engine's own DOM work — construction, patching, its internal event listeners — runs inside `ngZone.runOutsideAngular()`, so none of it triggers Angular's change detection. The *only* things Angular is told about are explicit: the `dataPointClick`/`dataPointHover` `@Output` emissions, which deliberately re-enter the zone via `ngZone.run()` so a consumer's own bindings update correctly. This is the same pattern Angular's own docs recommend for wrapping third-party imperative libraries (D3, maps, video players) — applied here because the chart engine itself is exactly that kind of library from Angular's point of view.

## What actually verifying this in a browser found

Both packages had solid unit test coverage before the demo app existed — 64 tests for the core engine, 9 for the Angular wrapper, all passing. None of them caught two real bugs that only showed up once the demo was actually opened in a browser:

**Angular's dependency injection was silently broken.** `ChartComponent`'s constructor takes `ElementRef` and `NgZone` without explicit injection tokens — Angular normally infers the token from the parameter's *type*, which requires TypeScript's `emitDecoratorMetadata` compiler option. The package is built with `tsup` (esbuild under the hood), and **esbuild doesn't implement `emitDecoratorMetadata`** — it has no type checker, so it can't resolve what `ElementRef` even refers to. The result: `NG0202`, a runtime error, the moment any real Angular app tried to construct the component. The component's own unit tests never caught this because they construct the class directly with `new ChartComponent(...)`, bypassing Angular's DI factory entirely — a real gap in that testing approach, now fixed by using explicit `@Inject()` tokens for every constructor parameter, which don't need that metadata at all.

**Bootstrapping Angular could silently take React down with it.** The demo mounts a React app and an Angular app on the same page from one script. `@angular/platform-browser`'s `bootstrapApplication` transitively loads `@angular/common`, which ships some Ivy partially-compiled code that throws synchronously at *import time* without the JIT compiler loaded. Because that throw happens during module evaluation — before any of the script's own function-body code runs — it aborted the entire script, including the React half sitting below it in the same file. Fixed with an explicit `import '@angular/compiler'` first.

Full details, plus a third (demo-only) bug involving a React StrictMode timing race in the "same node" proof check, are in [PROGRESS.md](../PROGRESS.md) under Day 6.

## Where it stands

Line, bar (grouped/stacked), and pie/donut charts; color palettes, axis/tooltip/legend/title/animation config; `ResizeObserver`-based responsive sizing implemented once in the core so both wrappers get it free. 81 tests across the three packages. A demo app runs React and Angular side by side from shared config-construction code, with a live proof of the in-place-update claim.

Not done: a Vue wrapper, canvas/WebGL rendering for large datasets, an accessibility pass, and — worth being direct about — the Angular package is still built with `tsup` rather than `ng-packagr`, which a real npm-publishable Angular library needs for proper Ivy partial-compilation output. See [PROGRESS.md](../PROGRESS.md) for the complete, honestly-tracked list of what's shipped versus deferred.
