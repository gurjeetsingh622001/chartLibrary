import type { ChartConfig } from '@chart-lib/core';

// Shared between the React and Angular demo apps deliberately — visual
// parity between the two wrappers is proven by literally rendering the
// same config-construction code, not by eyeballing two separately-authored
// configs that happen to look similar.

export function createLineConfig(): ChartConfig {
  return {
    type: 'line',
    title: { text: 'Monthly Revenue' },
    legend: { enabled: true },
    tooltip: { enabled: true },
    responsive: true,
    height: 320,
    series: [
      {
        id: 'revenue',
        name: 'Revenue',
        line: { curve: 'monotone' },
        data: [
          { x: 'Jan', y: 42 },
          { x: 'Feb', y: 58 },
          { x: 'Mar', y: 51 },
          { x: 'Apr', y: 67 },
          { x: 'May', y: 73 },
          { x: 'Jun', y: 61 },
        ],
      },
    ],
  };
}

export function createBarConfig(): ChartConfig {
  return {
    type: 'bar',
    title: { text: 'Team Output (Stacked)' },
    legend: { enabled: true },
    tooltip: { enabled: true },
    responsive: true,
    height: 320,
    series: [
      {
        id: 'team-a',
        name: 'Team A',
        bar: { stacked: true },
        data: [
          { x: 'Q1', y: 12 },
          { x: 'Q2', y: 19 },
          { x: 'Q3', y: 14 },
          { x: 'Q4', y: 22 },
        ],
      },
      {
        id: 'team-b',
        name: 'Team B',
        bar: { stacked: true },
        data: [
          { x: 'Q1', y: 8 },
          { x: 'Q2', y: 11 },
          { x: 'Q3', y: 16 },
          { x: 'Q4', y: 9 },
        ],
      },
    ],
  };
}

export function createPieConfig(): ChartConfig {
  return {
    type: 'pie',
    title: { text: 'Traffic Sources' },
    legend: { enabled: true },
    tooltip: { enabled: true },
    responsive: true,
    height: 320,
    series: [
      {
        id: 'sources',
        name: 'Traffic',
        pie: { innerRadius: 0.5, labelPosition: 'outside' },
        data: [
          { x: 'Organic', y: 45 },
          { x: 'Paid', y: 25 },
          { x: 'Referral', y: 15 },
          { x: 'Social', y: 15 },
        ],
      },
    ],
  };
}

/**
 * The live-update scenario: returns a NEW config object with randomized
 * line values. Both demo apps call this on an interval / button click to
 * prove the same "patch in place, don't rebuild" behavior in both
 * frameworks — this is the one thing the whole project is actually about.
 */
export function randomizeLineConfig(base: ChartConfig): ChartConfig {
  return {
    ...base,
    series: base.series.map((series) => ({
      ...series,
      data: series.data.map((point) => ({
        ...point,
        y: Math.max(5, Math.round(point.y + (Math.random() - 0.5) * 20)),
      })),
    })),
  };
}
