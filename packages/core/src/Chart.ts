import type {
  AxisType,
  ChartConfig,
  ChartConfigUpdate,
  ChartEventHandler,
  ChartEventMap,
  DataPoint,
  SeriesConfig,
} from './types';
import { createBandScale, createLinearScale, niceTicks, type BandScale, type Scale } from './internal/scale';
import { resolveSeriesColor } from './internal/color';
import { buildLinePath } from './internal/path';
import { mergeChartConfig } from './internal/mergeConfig';
import { createSvgElement, setAttrs } from './internal/svg';

type Listener = (payload: never) => void;

const DEFAULT_MARGIN = { top: 24, right: 24, bottom: 32, left: 48 };
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 360;
const DEFAULT_ANIMATION_DURATION = 400;

interface PixelPoint<T> {
  x: number;
  y: number;
  raw: DataPoint<T>;
}

interface Layout<T> {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  xType: AxisType;
  yScale: Scale;
  yTicks: number[];
  xDomain: [number, number] | null;
  categories: string[];
  xBand: BandScale | null;
  xLinear: Scale | null;
  pixelPointsFor: (series: SeriesConfig<T>) => PixelPoint<T>[];
}

interface RenderState {
  svg: SVGSVGElement;
  seriesPaths: Map<string, SVGPathElement>;
  seriesPointGroups: Map<string, SVGGElement>;
  gridGroup: SVGGElement;
  xAxisGroup: SVGGElement;
  yAxisGroup: SVGGElement;
  titleText: SVGTextElement | null;
  legendGroup: SVGGElement | null;
}

/**
 * Framework-agnostic chart instance. React/Angular wrappers only manage
 * instantiation, calling update() on prop/input changes, and calling
 * destroy() on unmount — this class has zero knowledge either framework
 * exists.
 *
 * Only the 'line' chart type renders for now; bar/pie share this same
 * scale/axis/tooltip machinery and are Day 3 work (see project brief).
 */
export class Chart<T = unknown> {
  private container: HTMLElement;
  private config: ChartConfig<T>;
  private listeners = new Map<keyof ChartEventMap<T>, Set<Listener>>();
  private state: RenderState | null = null;
  private tooltipEl: HTMLDivElement | null = null;

  constructor(container: HTMLElement, config: ChartConfig<T>) {
    this.container = container;
    this.config = config;
    this.renderFull();
  }

  update(partial: ChartConfigUpdate<T>): void {
    const next = mergeChartConfig(this.config, partial);
    const structural = !this.state || this.isStructuralChange(this.config, next);
    this.config = next;
    if (structural) {
      this.renderFull();
    } else {
      this.patch();
    }
  }

  destroy(): void {
    this.listeners.clear();
    this.container.innerHTML = '';
    this.state = null;
    this.tooltipEl = null;
  }

  on<K extends keyof ChartEventMap<T>>(event: K, handler: ChartEventHandler<T, K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Listener);
  }

  off<K extends keyof ChartEventMap<T>>(event: K, handler: ChartEventHandler<T, K>): void {
    this.listeners.get(event)?.delete(handler as Listener);
  }

  protected emit<K extends keyof ChartEventMap<T>>(event: K, payload: ChartEventMap<T>[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload as never));
  }

  private isStructuralChange(prev: ChartConfig<T>, next: ChartConfig<T>): boolean {
    if (prev.type !== next.type) return true;
    if (prev.series.length !== next.series.length) return true;
    for (let i = 0; i < prev.series.length; i++) {
      if (prev.series[i]!.id !== next.series[i]!.id) return true;
    }
    return false;
  }

  // --- Full (re)build: clears the container and creates every SVG node
  // fresh. Runs on mount and on structural changes (series added/removed/
  // reordered, chart type changed). ---
  private renderFull(): void {
    this.container.innerHTML = '';
    this.state = null;

    if (this.config.type !== 'line') {
      return;
    }

    const layout = this.computeLayout();
    if (!layout) {
      this.renderEmptyState();
      return;
    }

    const svg = createSvgElement('svg', {
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
    });
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';

    const plot = createSvgElement('g');
    svg.appendChild(plot);

    const gridGroup = createSvgElement('g', { class: 'chart-grid' });
    const yAxisGroup = createSvgElement('g', { class: 'chart-axis-y' });
    const xAxisGroup = createSvgElement('g', { class: 'chart-axis-x' });
    plot.appendChild(gridGroup);
    plot.appendChild(yAxisGroup);
    plot.appendChild(xAxisGroup);

    const seriesPaths = new Map<string, SVGPathElement>();
    const seriesPointGroups = new Map<string, SVGGElement>();
    for (const series of this.config.series) {
      const path = createSvgElement('path', { fill: 'none' });
      const pointGroup = createSvgElement('g', { class: 'chart-points' });
      plot.appendChild(path);
      plot.appendChild(pointGroup);
      seriesPaths.set(series.id, path);
      seriesPointGroups.set(series.id, pointGroup);
    }

    let titleText: SVGTextElement | null = null;
    if (this.config.title?.text) {
      titleText = createSvgElement('text', {
        x: layout.width / 2,
        y: 18,
        'text-anchor': 'middle',
        'font-weight': 'bold',
        fill: '#111827',
      });
      svg.appendChild(titleText);
    }

    let legendGroup: SVGGElement | null = null;
    if (this.config.legend?.enabled) {
      legendGroup = createSvgElement('g', { class: 'chart-legend' });
      svg.appendChild(legendGroup);
    }

    this.container.appendChild(svg);

    this.state = {
      svg,
      seriesPaths,
      seriesPointGroups,
      gridGroup,
      xAxisGroup,
      yAxisGroup,
      titleText,
      legendGroup,
    };

    this.applyLayout(layout, { initialMount: true });
  }

  private renderEmptyState(): void {
    const width = this.config.width ?? (this.container.clientWidth || DEFAULT_WIDTH);
    const height = this.config.height ?? (this.container.clientHeight || DEFAULT_HEIGHT);
    const svg = createSvgElement('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    const text = createSvgElement('text', {
      x: width / 2,
      y: height / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#6b7280',
    });
    text.textContent = 'No data';
    svg.appendChild(text);
    this.container.appendChild(svg);
  }

  // --- Patch: reuses the existing <svg>/<path> elements and only updates
  // their attributes. Runs on non-structural updates (new data values,
  // color/axis/tooltip/legend/title changes) — this is what makes update()
  // efficient instead of tearing the chart down and rebuilding it. ---
  private patch(): void {
    if (!this.state) {
      this.renderFull();
      return;
    }
    const layout = this.computeLayout();
    if (!layout) {
      // All series emptied out on a non-structural update — the DOM shape
      // genuinely needs to change to the empty-state placeholder.
      this.renderFull();
      return;
    }
    setAttrs(this.state.svg, {
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
    });
    this.applyLayout(layout, { initialMount: false });
  }

  private applyLayout(layout: Layout<T>, opts: { initialMount: boolean }): void {
    const state = this.state!;

    state.gridGroup.replaceChildren();
    if (this.config.axis?.y?.gridlines !== false) {
      for (const tick of layout.yTicks) {
        const y = layout.yScale(tick);
        state.gridGroup.appendChild(
          createSvgElement('line', {
            x1: layout.plotLeft,
            x2: layout.plotRight,
            y1: y,
            y2: y,
            stroke: '#e5e7eb',
            'stroke-width': 1,
          }),
        );
      }
    }

    state.yAxisGroup.replaceChildren();
    this.renderYAxis(state.yAxisGroup, layout);
    state.xAxisGroup.replaceChildren();
    this.renderXAxis(state.xAxisGroup, layout);

    const animationEnabled = this.config.animation?.enabled !== false;
    const duration = this.config.animation?.duration ?? DEFAULT_ANIMATION_DURATION;
    const easing = this.config.animation?.easing ?? 'ease';

    this.config.series.forEach((series, index) => {
      const path = state.seriesPaths.get(series.id);
      const pointGroup = state.seriesPointGroups.get(series.id);
      if (!path || !pointGroup) return;

      if (series.visible === false) {
        path.style.display = 'none';
        pointGroup.style.display = 'none';
        return;
      }
      path.style.display = '';
      pointGroup.style.display = '';

      const color = resolveSeriesColor(index, series.color, this.config.colors);
      const points = layout.pixelPointsFor(series);
      const d = buildLinePath(points, series.line?.curve ?? 'linear');

      setAttrs(path, { stroke: color, 'stroke-width': series.line?.width ?? 2 });
      if (series.line?.style === 'dashed') {
        path.setAttribute('stroke-dasharray', '6 4');
      } else {
        path.removeAttribute('stroke-dasharray');
      }

      if (animationEnabled) {
        path.style.transition = `d ${duration}ms ${easing}, opacity 200ms ease`;
        path.setAttribute('d', d);
        if (opts.initialMount) {
          // Defer the fade-in by a frame so the browser paints the
          // opacity:0 state first, otherwise there's nothing to transition
          // from and the path just appears instantly. Subsequent d changes
          // on an already-mounted path transition automatically since the
          // `transition` property is already active on the element.
          path.style.opacity = '0';
          requestAnimationFrameSafe(() => {
            path.style.opacity = '1';
          });
        } else {
          path.style.opacity = '1';
        }
      } else {
        path.style.transition = '';
        path.style.opacity = '1';
        path.setAttribute('d', d);
      }

      this.renderPoints(pointGroup, series, points, color);
    });

    if (state.titleText) {
      state.titleText.textContent = this.config.title?.text ?? '';
    }

    if (state.legendGroup) {
      state.legendGroup.replaceChildren();
      this.renderLegend(state.legendGroup, layout);
    }
  }

  private renderPoints(
    group: SVGGElement,
    series: SeriesConfig<T>,
    points: PixelPoint<T>[],
    color: string,
  ): void {
    group.replaceChildren();
    if (series.line?.points?.visible === false) {
      return;
    }
    for (const point of points) {
      const circle = createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: series.line?.points?.size ?? 3,
        fill: color,
      });
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', () => this.emit('click', { point: point.raw, series }));
      circle.addEventListener('mouseenter', () => {
        this.emit('hover', { point: point.raw, series });
        this.showTooltip(point.raw, series, point.x, point.y);
      });
      circle.addEventListener('mouseleave', () => this.hideTooltip());
      group.appendChild(circle);
    }
  }

  private renderYAxis(group: SVGGElement, layout: Layout<T>): void {
    for (const tick of layout.yTicks) {
      const y = layout.yScale(tick);
      const label = this.config.axis?.y?.labelFormatter?.(tick) ?? String(tick);
      const text = createSvgElement('text', {
        x: layout.plotLeft - 8,
        y,
        'text-anchor': 'end',
        'dominant-baseline': 'middle',
        fill: '#6b7280',
        'font-size': 11,
      });
      text.textContent = label;
      group.appendChild(text);
    }
    group.appendChild(
      createSvgElement('line', {
        x1: layout.plotLeft,
        x2: layout.plotLeft,
        y1: layout.plotTop,
        y2: layout.plotBottom,
        stroke: '#9ca3af',
      }),
    );
  }

  private renderXAxis(group: SVGGElement, layout: Layout<T>): void {
    group.appendChild(
      createSvgElement('line', {
        x1: layout.plotLeft,
        x2: layout.plotRight,
        y1: layout.plotBottom,
        y2: layout.plotBottom,
        stroke: '#9ca3af',
      }),
    );

    const addLabel = (x: number, raw: number | string) => {
      const label = this.config.axis?.x?.labelFormatter?.(raw) ?? String(raw);
      const text = createSvgElement('text', {
        x,
        y: layout.plotBottom + 16,
        'text-anchor': 'middle',
        fill: '#6b7280',
        'font-size': 11,
      });
      text.textContent = label;
      group.appendChild(text);
    };

    if (layout.xType === 'category') {
      for (const category of layout.categories) {
        const x = layout.xBand!(category);
        if (x !== undefined) addLabel(x, category);
      }
    } else if (layout.xDomain) {
      const ticks = niceTicks(layout.xDomain[0], layout.xDomain[1], this.config.axis?.x?.tickCount ?? 5);
      for (const tick of ticks) {
        addLabel(layout.xLinear!(tick), tick);
      }
    }
  }

  private renderLegend(group: SVGGElement, layout: Layout<T>): void {
    let x = layout.plotLeft;
    const y = layout.height - 8;
    this.config.series.forEach((series, index) => {
      const hidden = series.visible === false;
      const color = resolveSeriesColor(index, series.color, this.config.colors);
      const item = createSvgElement('g');
      item.style.cursor = 'pointer';
      item.appendChild(
        createSvgElement('rect', { x, y: y - 10, width: 10, height: 10, fill: hidden ? '#d1d5db' : color }),
      );
      const text = createSvgElement('text', {
        x: x + 14,
        y,
        'font-size': 11,
        fill: hidden ? '#9ca3af' : '#111827',
      });
      text.textContent = series.name;
      item.appendChild(text);
      item.addEventListener('click', () => this.toggleSeries(series.id));
      group.appendChild(item);
      x += 14 + series.name.length * 6 + 16;
    });
  }

  private toggleSeries(id: string): void {
    const series = this.config.series.find((s) => s.id === id);
    if (!series) return;
    const nextVisible = series.visible === false;
    this.config.legend?.onToggle?.(id, nextVisible);
    this.update({
      series: this.config.series.map((s) => (s.id === id ? { ...s, visible: nextVisible } : s)),
    });
  }

  private ensureTooltipEl(): HTMLDivElement {
    if (this.tooltipEl) return this.tooltipEl;
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.padding = '4px 8px';
    el.style.background = 'rgba(17,24,39,0.9)';
    el.style.color = '#fff';
    el.style.fontSize = '12px';
    el.style.borderRadius = '4px';
    el.style.transform = 'translate(-50%, -120%)';
    el.style.whiteSpace = 'nowrap';
    el.style.display = 'none';
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.appendChild(el);
    this.tooltipEl = el;
    return el;
  }

  private showTooltip(point: DataPoint<T>, series: SeriesConfig<T>, x: number, y: number): void {
    if (this.config.tooltip?.enabled === false) return;
    const el = this.ensureTooltipEl();
    el.textContent = this.config.tooltip?.formatter?.(point, series) ?? `${series.name}: ${point.y}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.display = 'block';
  }

  private hideTooltip(): void {
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
  }

  private computeLayout(): Layout<T> | null {
    // "No data" (the empty-state placeholder) means there is nothing to
    // plot anywhere, regardless of visibility — toggling every series off
    // via the legend should just hide their lines, not collapse the whole
    // chart (axes, legend included) down to a placeholder.
    const hasAnyData = this.config.series.some((s) => cleanPoints(s.data).length > 0);
    if (!hasAnyData) return null;

    const visibleSeriesWithData = this.config.series.filter(
      (s) => s.visible !== false && cleanPoints(s.data).length > 0,
    );
    // If every series is currently hidden, fall back to the full series set
    // for domain calculation so the axes stay put instead of collapsing to
    // a default range while nothing is shown.
    const domainSeries = visibleSeriesWithData.length > 0 ? visibleSeriesWithData : this.config.series;

    const width = this.config.width ?? (this.container.clientWidth || DEFAULT_WIDTH);
    const height = this.config.height ?? (this.container.clientHeight || DEFAULT_HEIGHT);
    const margin = { ...DEFAULT_MARGIN, ...this.config.margin };

    const plotLeft = margin.left;
    const plotTop = margin.top + (this.config.title?.text ? 24 : 0);
    const plotRight = width - margin.right;
    const plotBottom = height - margin.bottom - (this.config.legend?.enabled ? 24 : 0);

    const yValues = domainSeries.flatMap((s) => cleanPoints(s.data).map((p) => p.y));
    const yMin = this.config.axis?.y?.min ?? Math.min(0, ...yValues);
    const yMax = this.config.axis?.y?.max ?? Math.max(...yValues);
    const yScale = createLinearScale([yMin, yMax], [plotBottom, plotTop]);
    const yTicks = niceTicks(yMin, yMax, this.config.axis?.y?.tickCount ?? 5);

    // 'time' is treated as a numeric domain (timestamps), same as 'linear' —
    // a v1 simplification; see AxisType in types.ts.
    const xType = this.config.axis?.x?.type ?? inferAxisType(domainSeries);
    let categories: string[] = [];
    let xBand: BandScale | null = null;
    let xLinear: Scale | null = null;
    let xDomain: [number, number] | null = null;

    if (xType === 'category') {
      categories = Array.from(
        new Set(domainSeries.flatMap((s) => cleanPoints(s.data).map((p) => String(p.x)))),
      );
      xBand = createBandScale(categories, [plotLeft, plotRight]);
    } else {
      const xValues = domainSeries.flatMap((s) => cleanPoints(s.data).map((p) => Number(p.x)));
      const xMin = this.config.axis?.x?.min ?? Math.min(...xValues);
      const xMax = this.config.axis?.x?.max ?? Math.max(...xValues);
      xDomain = [xMin, xMax];
      xLinear = createLinearScale([xMin, xMax], [plotLeft, plotRight]);
    }

    const pixelPointsFor = (series: SeriesConfig<T>): PixelPoint<T>[] => {
      const points = cleanPoints(series.data)
        .map((p): PixelPoint<T> | null => {
          const x = xType === 'category' ? xBand!(String(p.x)) : xLinear!(Number(p.x));
          return x === undefined ? null : { x, y: yScale(p.y), raw: p };
        })
        .filter((p): p is PixelPoint<T> => p !== null);
      if (xType !== 'category') {
        points.sort((a, b) => a.x - b.x);
      }
      return points;
    };

    return {
      width,
      height,
      plotLeft,
      plotTop,
      plotRight,
      plotBottom,
      xType,
      yScale,
      yTicks,
      xDomain,
      categories,
      xBand,
      xLinear,
      pixelPointsFor,
    };
  }
}

function cleanPoints<T>(data: DataPoint<T>[]): DataPoint<T>[] {
  return data.filter((p) => {
    if (p.x === null || p.x === undefined) return false;
    if (typeof p.x === 'number' && !Number.isFinite(p.x)) return false;
    return Number.isFinite(p.y);
  });
}

function inferAxisType<T>(series: SeriesConfig<T>[]): AxisType {
  const firstPoint = series.flatMap((s) => s.data)[0];
  return typeof firstPoint?.x === 'string' ? 'category' : 'linear';
}

function requestAnimationFrameSafe(cb: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(cb);
  } else {
    setTimeout(cb, 0);
  }
}
