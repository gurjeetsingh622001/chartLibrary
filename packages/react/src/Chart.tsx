import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Chart as CoreChart } from '@chart-lib/core';
import type { ChartConfig, ChartEventMap } from '@chart-lib/core';

export interface ChartProps<T = unknown> {
  config: ChartConfig<T>;
  className?: string;
  style?: CSSProperties;
  onDataPointClick?: (payload: ChartEventMap<T>['click']) => void;
  onDataPointHover?: (payload: ChartEventMap<T>['hover']) => void;
}

/**
 * Thin React binding over the framework-agnostic core engine: this
 * component only manages instantiation, calling update() on prop changes,
 * and destroy() on unmount. It has no rendering logic of its own.
 */
export function Chart<T = unknown>({
  config,
  className,
  style,
  onDataPointClick,
  onDataPointHover,
}: ChartProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CoreChart<T> | null>(null);
  const isFirstConfigEffect = useRef(true);

  // Mount once. StrictMode's dev-only double-invoke (mount -> cleanup ->
  // mount) is safe here without a guard flag because destroy() fully tears
  // down the container and listener map, so re-running this setup is
  // idempotent — adding a "skip the second run" flag would just be masking
  // what StrictMode is trying to surface, not actually fixing anything.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new CoreChart<T>(containerRef.current, config);
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // config intentionally excluded: prop changes are handled by update()
    // in the effect below, not by recreating the chart instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Config changes patch the existing instance instead of recreating it —
  // this is the whole point of update() existing. Skips the redundant
  // no-op update on initial mount, since the constructor above already
  // rendered this exact config.
  useEffect(() => {
    if (isFirstConfigEffect.current) {
      isFirstConfigEffect.current = false;
      return;
    }
    chartRef.current?.update(config);
  }, [config]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onDataPointClick) return;
    chart.on('click', onDataPointClick);
    return () => chart.off('click', onDataPointClick);
  }, [onDataPointClick]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onDataPointHover) return;
    chart.on('hover', onDataPointHover);
    return () => chart.off('hover', onDataPointHover);
  }, [onDataPointHover]);

  return <div ref={containerRef} className={className} style={style} />;
}
