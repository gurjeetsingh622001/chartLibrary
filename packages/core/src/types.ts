export interface DataPoint<T = unknown> {
  x: number | string;
  y: number;
  meta?: T;
}

export type AxisType = 'category' | 'linear' | 'time';

export interface AxisConfig {
  type?: AxisType;
  tickCount?: number;
  labelFormatter?: (value: number | string) => string;
  gridlines?: boolean;
  title?: string;
  min?: number;
  max?: number;
}

export interface TooltipConfig<T = unknown> {
  enabled?: boolean;
  /** Show all series at the hovered x-value, not just the nearest point. */
  shared?: boolean;
  formatter?: (point: DataPoint<T>, series: SeriesConfig<T>) => string;
}

export interface LegendConfig {
  enabled?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onToggle?: (seriesId: string, visible: boolean) => void;
}

export interface TitleConfig {
  text?: string;
  position?: 'top' | 'bottom';
}

export interface AnimationConfig {
  enabled?: boolean;
  duration?: number;
  easing?: string;
}

export interface MarginConfig {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface LineSeriesStyle {
  style?: 'solid' | 'dashed';
  width?: number;
  curve?: 'linear' | 'monotone' | 'step';
  points?: {
    visible?: boolean;
    shape?: 'circle' | 'square';
    size?: number;
  };
}

export interface BarSeriesStyle {
  stacked?: boolean;
  cornerRadius?: number;
}

export interface PieSeriesStyle {
  innerRadius?: number;
  labelPosition?: 'inside' | 'outside';
}

export interface SeriesConfig<T = unknown> {
  id: string;
  name: string;
  data: DataPoint<T>[];
  color?: string;
  visible?: boolean;
  line?: LineSeriesStyle;
  bar?: BarSeriesStyle;
  pie?: PieSeriesStyle;
}

export type ChartType = 'line' | 'bar' | 'pie';

export interface ChartEventMap<T = unknown> {
  click: { point: DataPoint<T>; series: SeriesConfig<T> };
  hover: { point: DataPoint<T>; series: SeriesConfig<T> };
}

export type ChartEventHandler<T, K extends keyof ChartEventMap<T>> = (
  payload: ChartEventMap<T>[K],
) => void;

export interface ChartConfig<T = unknown> {
  type: ChartType;
  series: SeriesConfig<T>[];
  colors?: string[];
  axis?: {
    x?: AxisConfig;
    y?: AxisConfig;
  };
  tooltip?: TooltipConfig<T>;
  legend?: LegendConfig;
  title?: TitleConfig;
  animation?: AnimationConfig;
  margin?: MarginConfig;
  width?: number;
  height?: number;
  responsive?: boolean;
}

/**
 * update() takes a partial config and deep-merges it into the existing one —
 * see "update(partialConfig) semantics" in the project brief. The engine
 * diffs old vs. new to decide the minimal action (repatch data, restyle, or
 * full relayout) instead of always doing a full re-render.
 */
export type ChartConfigUpdate<T = unknown> = {
  [K in keyof ChartConfig<T>]?: ChartConfig<T>[K];
};
