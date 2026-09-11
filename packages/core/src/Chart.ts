import type {
  ChartConfig,
  ChartConfigUpdate,
  ChartEventHandler,
  ChartEventMap,
} from './types';

type Listener = (payload: never) => void;

/**
 * Framework-agnostic chart instance. React/Angular wrappers only manage
 * instantiation, calling update() on prop/input changes, and calling
 * destroy() on unmount — this class has zero knowledge either framework
 * exists.
 *
 * Rendering (scale/axis calculation, SVG output, animation) is Day 1-2 work
 * and is not implemented yet; this class currently locks in the public API
 * shape (constructor, update, destroy, on/off) that the rest of the project
 * depends on.
 */
export class Chart<T = unknown> {
  private container: HTMLElement;
  private config: ChartConfig<T>;
  private listeners = new Map<keyof ChartEventMap<T>, Set<Listener>>();

  constructor(container: HTMLElement, config: ChartConfig<T>) {
    this.container = container;
    this.config = config;
    this.render();
  }

  update(partial: ChartConfigUpdate<T>): void {
    // TODO (Day 1-2): diff this.config vs. the merged result and apply the
    // minimal change — new series data -> repatch points, changed color ->
    // restyle only, changed type/series count -> full relayout. Currently
    // always does a full re-render.
    this.config = { ...this.config, ...partial };
    this.render();
  }

  destroy(): void {
    this.listeners.clear();
    this.container.innerHTML = '';
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

  private render(): void {
    // TODO (Day 1-2): scale/axis calculation + SVG rendering for the
    // configured chart type.
    // Empty-state behavior (locked in the brief): no series, or a series
    // with no data points, renders an empty-state placeholder rather than
    // throwing or leaving stale markup.
  }
}
