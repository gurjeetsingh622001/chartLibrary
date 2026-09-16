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
import { buildArcPath, computeSliceAngles, type Slice } from './internal/arc';
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

interface BarRect<T> {
  x: number;
  y: number;
  width: number;
  height: number;
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
  seriesGroups: Map<string, SVGGElement>;
  gridGroup: SVGGElement;
  xAxisGroup: SVGGElement;
  yAxisGroup: SVGGElement;
  titleText: SVGTextElement | null;
  legendGroup: SVGGElement | null;
}

interface PieSlice<T> extends Slice {
  color: string;
  raw: DataPoint<T>;
}

interface PieLayout<T> {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  innerRadius: number;
  series: SeriesConfig<T>;
  slices: PieSlice<T>[];
}

interface PieRenderState {
  svg: SVGSVGElement;
  slicePaths: Map<string, SVGPathElement>;
  labelGroup: SVGGElement;
  titleText: SVGTextElement | null;
  legendGroup: SVGGElement | null;
}

/**
 * Framework-agnostic chart instance. React/Angular wrappers only manage
 * instantiation, calling update() on prop/input changes, and calling
 * destroy() on unmount — this class has zero knowledge either framework
 * exists.
 *
 * 'line' and 'bar' share the same axis/scale machinery (computeLayout) and
 * only differ in how a series' marks are drawn. 'pie' has no axes and gets
 * its own layout/render path (computePieLayout/applyPieLayout).
 */
export class Chart<T = unknown> {
  private container: HTMLElement;
  private config: ChartConfig<T>;
  private listeners = new Map<keyof ChartEventMap<T>, Set<Listener>>();
  private state: RenderState | null = null;
  private pieState: PieRenderState | null = null;
  private mounted = false;
  private tooltipEl: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, config: ChartConfig<T>) {
    this.container = container;
    this.config = config;
    this.renderFull();
    this.syncResizeObserver();
  }

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

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.listeners.clear();
    this.container.innerHTML = '';
    this.state = null;
    this.pieState = null;
    this.mounted = false;
    this.tooltipEl = null;
  }

  // config.responsive opts into tracking the container's size instead of a
  // fixed width/height — computeLayout()/computePieLayout() already read
  // container.clientWidth/clientHeight fresh whenever config.width/height
  // is unset, so all a resize needs to do is trigger the same patch() path
  // used for data updates (an in-place relayout, not a rebuild). If both
  // responsive and explicit width/height are set, explicit wins and resize
  // events are a no-op — nothing to skip that would need extra guarding.
  private syncResizeObserver(): void {
    const shouldObserve =
      this.config.responsive === true &&
      (this.config.width === undefined || this.config.height === undefined) &&
      typeof ResizeObserver !== 'undefined';
    if (shouldObserve && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    } else if (!shouldObserve && this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private handleResize = (): void => {
    if (this.config.type === 'pie') {
      this.patchPie();
    } else {
      this.patch();
    }
  };

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
    this.pieState = null;
    this.mounted = false;

    if (this.config.type === 'pie') {
      this.renderPieFull();
      return;
    }
    if (this.config.type !== 'line' && this.config.type !== 'bar') {
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

    const seriesGroups = new Map<string, SVGGElement>();
    for (const series of this.config.series) {
      const group = createSvgElement('g', { class: 'chart-series' });
      if (this.config.type === 'line') {
        group.appendChild(createSvgElement('path', { fill: 'none' }));
        group.appendChild(createSvgElement('g', { class: 'chart-points' }));
      }
      plot.appendChild(group);
      seriesGroups.set(series.id, group);
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
      seriesGroups,
      gridGroup,
      xAxisGroup,
      yAxisGroup,
      titleText,
      legendGroup,
    };
    this.mounted = true;

    this.applyLayout(layout, { initialMount: true });
  }

  private renderEmptyState(): void {
    const { width, height } = this.resolveSize();
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

  // --- Patch: reuses the existing <svg>/mark elements and only updates
  // their attributes. Runs on non-structural updates (new data values,
  // color/axis/tooltip/legend/title changes) — this is what makes update()
  // efficient instead of tearing the chart down and rebuilding it. ---
  private patch(): void {
    if (this.config.type === 'pie') {
      this.patchPie();
      return;
    }
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
    const barRects = this.config.type === 'bar' ? this.computeBarRects(layout) : null;

    this.config.series.forEach((series, index) => {
      const group = state.seriesGroups.get(series.id);
      if (!group) return;

      if (series.visible === false) {
        group.style.display = 'none';
        return;
      }
      group.style.display = '';

      const color = resolveSeriesColor(index, series.color, this.config.colors);

      if (this.config.type === 'line') {
        const path = group.querySelector('path') as SVGPathElement;
        const pointGroup = group.querySelector('g.chart-points') as SVGGElement;
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
      } else if (this.config.type === 'bar') {
        this.renderBars(group, series, barRects?.get(series.id) ?? [], color);
      }
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

  // Bar geometry for every series is computed together (not per-series in
  // isolation) because a stacked layout needs a running per-category
  // baseline shared across series.
  private computeBarRects(layout: Layout<T>): Map<string, BarRect<T>[]> {
    const result = new Map<string, BarRect<T>[]>();
    if (!layout.xBand) return result;

    const stacked = this.config.series.some((s) => s.bar?.stacked);
    const numSeries = this.config.series.length;
    const bandwidth = layout.xBand.bandwidth;
    const zeroY = layout.yScale(0);
    const cumulative = new Map<string, number>(layout.categories.map((c) => [c, 0]));

    this.config.series.forEach((series, index) => {
      const rects: BarRect<T>[] = [];
      if (series.visible === false) {
        result.set(series.id, rects);
        return;
      }
      for (const point of cleanPoints(series.data)) {
        const category = String(point.x);
        const cx = layout.xBand!(category);
        if (cx === undefined) continue;

        let x: number;
        let width: number;
        let y0: number;
        let y1: number;
        if (stacked) {
          width = bandwidth * 0.8;
          x = cx - width / 2;
          const base = cumulative.get(category) ?? 0;
          const next = base + point.y;
          cumulative.set(category, next);
          y0 = layout.yScale(base);
          y1 = layout.yScale(next);
        } else {
          const slotWidth = bandwidth / numSeries;
          width = slotWidth * 0.8;
          x = cx - bandwidth / 2 + index * slotWidth + (slotWidth - width) / 2;
          y0 = zeroY;
          y1 = layout.yScale(point.y);
        }
        rects.push({ x, y: Math.min(y0, y1), width, height: Math.abs(y1 - y0), raw: point });
      }
      result.set(series.id, rects);
    });
    return result;
  }

  private renderBars(group: SVGGElement, series: SeriesConfig<T>, rects: BarRect<T>[], color: string): void {
    group.replaceChildren();
    for (const rect of rects) {
      const el = createSvgElement('rect', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        fill: color,
        rx: series.bar?.cornerRadius ?? 0,
      });
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this.emit('click', { point: rect.raw, series }));
      el.addEventListener('mouseenter', () => {
        this.emit('hover', { point: rect.raw, series });
        this.showTooltip(rect.raw, series, rect.x + rect.width / 2, rect.y);
      });
      el.addEventListener('mouseleave', () => this.hideTooltip());
      group.appendChild(el);
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

  // --- Pie: no axes, so it gets its own layout and render path instead of
  // going through computeLayout()/applyLayout() above. A pie chart plots
  // one series' data points as slices (point.x -> label, point.y -> value);
  // if multiple series are configured, only the first one with data is
  // used — a pie has no meaning for more than one series at once. ---
  private renderPieFull(): void {
    const layout = this.computePieLayout();
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

    const labelGroup = createSvgElement('g', { class: 'chart-pie-labels' });
    svg.appendChild(labelGroup);

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

    this.pieState = { svg, slicePaths: new Map(), labelGroup, titleText, legendGroup };
    this.mounted = true;

    this.applyPieLayout(layout, { initialMount: true });
  }

  private patchPie(): void {
    if (!this.pieState) {
      this.renderFull();
      return;
    }
    const layout = this.computePieLayout();
    if (!layout) {
      this.renderFull();
      return;
    }
    setAttrs(this.pieState.svg, {
      width: layout.width,
      height: layout.height,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
    });
    this.applyPieLayout(layout, { initialMount: false });
  }

  private applyPieLayout(layout: PieLayout<T>, opts: { initialMount: boolean }): void {
    const state = this.pieState!;
    const animationEnabled = this.config.animation?.enabled !== false;
    const duration = this.config.animation?.duration ?? DEFAULT_ANIMATION_DURATION;
    const easing = this.config.animation?.easing ?? 'ease';
    const activeIds = new Set(layout.slices.map((s) => s.id));

    for (const [id, path] of state.slicePaths) {
      if (!activeIds.has(id)) {
        path.remove();
        state.slicePaths.delete(id);
      }
    }

    for (const slice of layout.slices) {
      let path = state.slicePaths.get(slice.id);
      const isNew = !path;
      if (!path) {
        path = createSvgElement('path', { stroke: '#fff', 'stroke-width': 1 });
        path.style.cursor = 'pointer';
        state.svg.insertBefore(path, state.labelGroup);
        state.slicePaths.set(slice.id, path);
      }
      setAttrs(path, { fill: slice.color });
      const d = buildArcPath(layout.cx, layout.cy, layout.radius, layout.innerRadius, slice.startAngle, slice.endAngle);

      if (animationEnabled) {
        path.style.transition = `d ${duration}ms ${easing}, opacity 200ms ease`;
        path.setAttribute('d', d);
        if (isNew && opts.initialMount) {
          path.style.opacity = '0';
          const target = path;
          requestAnimationFrameSafe(() => {
            target.style.opacity = '1';
          });
        } else {
          path.style.opacity = '1';
        }
      } else {
        path.style.transition = '';
        path.style.opacity = '1';
        path.setAttribute('d', d);
      }

      // Assigned as properties (not addEventListener) so a slice that
      // persists across patches doesn't accumulate a new listener on every
      // update — each assignment replaces the previous handler.
      path.onclick = () => this.emit('click', { point: slice.raw, series: layout.series });
      path.onmouseenter = () => {
        this.emit('hover', { point: slice.raw, series: layout.series });
        const mid = (slice.startAngle + slice.endAngle) / 2;
        const tx = layout.cx + Math.cos(mid) * layout.radius * 0.6;
        const ty = layout.cy + Math.sin(mid) * layout.radius * 0.6;
        this.showTooltip(slice.raw, layout.series, tx, ty);
      };
      path.onmouseleave = () => this.hideTooltip();
    }

    state.labelGroup.replaceChildren();
    const labelPosition = layout.series.pie?.labelPosition ?? 'outside';
    for (const slice of layout.slices) {
      const mid = (slice.startAngle + slice.endAngle) / 2;
      const labelRadius = labelPosition === 'inside' ? layout.radius * 0.65 : layout.radius + 14;
      const text = createSvgElement('text', {
        x: layout.cx + Math.cos(mid) * labelRadius,
        y: layout.cy + Math.sin(mid) * labelRadius,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: labelPosition === 'inside' ? '#fff' : '#374151',
        'font-size': 11,
      });
      text.textContent = slice.label;
      state.labelGroup.appendChild(text);
    }

    if (state.titleText) {
      state.titleText.textContent = this.config.title?.text ?? '';
    }

    if (state.legendGroup) {
      state.legendGroup.replaceChildren();
      let x = 8;
      const y = layout.height - 8;
      layout.slices.forEach((slice) => {
        const item = createSvgElement('g');
        item.appendChild(createSvgElement('rect', { x, y: y - 10, width: 10, height: 10, fill: slice.color }));
        const text = createSvgElement('text', { x: x + 14, y, 'font-size': 11, fill: '#111827' });
        text.textContent = slice.label;
        item.appendChild(text);
        state.legendGroup!.appendChild(item);
        x += 14 + slice.label.length * 6 + 16;
      });
    }
  }

  private computePieLayout(): PieLayout<T> | null {
    const series = this.config.series.find((s) => cleanPoints(s.data).length > 0);
    if (!series) return null;
    const points = cleanPoints(series.data).filter((p) => p.y > 0);
    if (points.length === 0) return null;

    const { width, height } = this.resolveSize();
    const titleSpace = this.config.title?.text ? 24 : 0;
    const legendSpace = this.config.legend?.enabled ? 32 : 0;
    const cx = width / 2;
    const plotHeight = height - titleSpace - legendSpace;
    const cy = titleSpace + plotHeight / 2;
    const radius = Math.max(10, Math.min(width, plotHeight) / 2 - 16);
    const innerRadius = (series.pie?.innerRadius ?? 0) * radius;

    const angles = computeSliceAngles(points.map((p) => ({ id: String(p.x), label: String(p.x), value: p.y })));
    const slices: PieSlice<T>[] = angles.map((slice, index) => ({
      ...slice,
      color: resolveSeriesColor(index, undefined, this.config.colors),
      raw: points[index]!,
    }));

    return { width, height, cx, cy, radius, innerRadius, series, slices };
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

  // Only reads the container's actual size when responsive is explicitly
  // on — otherwise always falls back to the fixed default, never to
  // container.clientWidth/clientHeight. Those can be misleadingly
  // non-zero for a container that has no *externally imposed* size (no
  // explicit CSS height, not inside a sized flex/grid parent): any
  // padding or border alone gives an "empty" div a real clientHeight
  // greater than zero, so `clientHeight || DEFAULT_HEIGHT` doesn't
  // reliably catch the "nothing has actually sized this yet" case — found
  // by testing against a real styled page, not the bare test containers
  // used in this package's own unit tests. Reading container size is only
  // meaningful under `responsive: true`, where the consumer is expected
  // to have given the container a real size from something other than
  // the chart's own content (a fixed height, a flex/grid layout, vh
  // units, etc.) — the same assumption the ResizeObserver hookup already
  // makes.
  private resolveSize(): { width: number; height: number } {
    const useContainerSize = this.config.responsive === true;
    const width = this.config.width ?? (useContainerSize ? this.container.clientWidth || DEFAULT_WIDTH : DEFAULT_WIDTH);
    const height =
      this.config.height ?? (useContainerSize ? this.container.clientHeight || DEFAULT_HEIGHT : DEFAULT_HEIGHT);
    return { width, height };
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

    const { width, height } = this.resolveSize();
    const margin = { ...DEFAULT_MARGIN, ...this.config.margin };

    const plotLeft = margin.left;
    const plotTop = margin.top + (this.config.title?.text ? 24 : 0);
    const plotRight = width - margin.right;
    const plotBottom = height - margin.bottom - (this.config.legend?.enabled ? 24 : 0);

    // 'time' is treated as a numeric domain (timestamps), same as 'linear' —
    // a v1 simplification; see AxisType in types.ts. Bar charts default to
    // a category axis since bars plot discrete groups.
    const xType =
      this.config.axis?.x?.type ?? (this.config.type === 'bar' ? 'category' : inferAxisType(domainSeries));
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

    const [yMin, yMax] = this.computeYDomain(domainSeries, categories);
    const yScale = createLinearScale([yMin, yMax], [plotBottom, plotTop]);
    const yTicks = niceTicks(yMin, yMax, this.config.axis?.y?.tickCount ?? 5);

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

  private computeYDomain(domainSeries: SeriesConfig<T>[], categories: string[]): [number, number] {
    if (this.config.type === 'bar' && domainSeries.some((s) => s.bar?.stacked)) {
      const sums = categories.map((category) =>
        domainSeries.reduce((sum, s) => {
          const point = cleanPoints(s.data).find((p) => String(p.x) === category);
          return sum + (point?.y ?? 0);
        }, 0),
      );
      const min = this.config.axis?.y?.min ?? Math.min(0, ...sums);
      const max = this.config.axis?.y?.max ?? Math.max(0, ...sums);
      return [min, max];
    }
    const values = domainSeries.flatMap((s) => cleanPoints(s.data).map((p) => p.y));
    const min = this.config.axis?.y?.min ?? Math.min(0, ...values);
    const max = this.config.axis?.y?.max ?? Math.max(...values);
    return [min, max];
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
