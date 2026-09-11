import type { ChartConfig, ChartConfigUpdate } from '../types';

/**
 * update(partial) deep-merges into the existing config rather than
 * replacing it outright (see "update(partialConfig) semantics" in the
 * project brief). Nested option objects (axis/tooltip/legend/title/
 * animation/margin) are merged one level deep so, e.g., patching axis.x
 * doesn't silently wipe out an existing axis.y. Arrays (series, colors) are
 * replaced wholesale — merging arrays element-by-element has no single
 * sensible meaning here.
 */
export function mergeChartConfig<T>(
  base: ChartConfig<T>,
  patch: ChartConfigUpdate<T>,
): ChartConfig<T> {
  return {
    ...base,
    ...patch,
    axis:
      patch.axis !== undefined
        ? { x: { ...base.axis?.x, ...patch.axis.x }, y: { ...base.axis?.y, ...patch.axis.y } }
        : base.axis,
    tooltip:
      patch.tooltip !== undefined ? { ...base.tooltip, ...patch.tooltip } : base.tooltip,
    legend: patch.legend !== undefined ? { ...base.legend, ...patch.legend } : base.legend,
    title: patch.title !== undefined ? { ...base.title, ...patch.title } : base.title,
    animation:
      patch.animation !== undefined ? { ...base.animation, ...patch.animation } : base.animation,
    margin: patch.margin !== undefined ? { ...base.margin, ...patch.margin } : base.margin,
  };
}
