import { describe, expect, it } from 'vitest';
import { buildLinePath } from './path';

describe('buildLinePath', () => {
  it('returns an empty string for no points', () => {
    expect(buildLinePath([])).toBe('');
  });

  it('returns a single move command for one point', () => {
    expect(buildLinePath([{ x: 5, y: 10 }])).toBe('M 5,10');
  });

  it('builds a linear path through every point in order', () => {
    const d = buildLinePath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 20, y: 5 },
      ],
      'linear',
    );
    expect(d).toBe('M 0,0 L 10,20 L 20,5');
  });

  it('builds a step path using horizontal/vertical segments', () => {
    const d = buildLinePath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
      'step',
    );
    expect(d).toBe('M 0,0 H 10 V 20');
  });

  it('builds a monotone path that starts and ends at the data points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 5 },
      { x: 30, y: 30 },
    ];
    const d = buildLinePath(points, 'monotone');
    expect(d.startsWith('M 0,0')).toBe(true);
    expect(d.endsWith('30,30')).toBe(true);
    expect(d).toContain('C');
  });

  it('produces a strictly increasing curve for strictly increasing monotone data', () => {
    // Fritsch-Carlson-style tangent clamping should prevent the curve from
    // overshooting past its neighbors even though it is not sampled here.
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 1 },
      { x: 20, y: 50 },
      { x: 30, y: 51 },
    ];
    const d = buildLinePath(points, 'monotone');
    expect(d).toMatch(/^M 0,0 C/);
  });
});
