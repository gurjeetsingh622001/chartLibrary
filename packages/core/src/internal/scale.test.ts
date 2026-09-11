import { describe, expect, it } from 'vitest';
import { createBandScale, createLinearScale, niceTicks } from './scale';

describe('createLinearScale', () => {
  it('maps domain endpoints to range endpoints', () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(200);
    expect(scale(50)).toBe(100);
  });

  it('handles an inverted range (SVG y-axis grows downward)', () => {
    const scale = createLinearScale([0, 10], [300, 0]);
    expect(scale(0)).toBe(300);
    expect(scale(10)).toBe(0);
    expect(scale(5)).toBe(150);
  });

  it('extrapolates for values outside the domain', () => {
    const scale = createLinearScale([0, 10], [0, 100]);
    expect(scale(-5)).toBe(-50);
    expect(scale(15)).toBe(150);
  });

  it('returns the range midpoint for a zero-width domain instead of dividing by zero', () => {
    const scale = createLinearScale([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(Number.isFinite(scale(5))).toBe(true);
  });
});

describe('createBandScale', () => {
  it('spaces bands evenly across the range', () => {
    const scale = createBandScale(['a', 'b', 'c', 'd'], [0, 400]);
    expect(scale('a')).toBeCloseTo(50);
    expect(scale('b')).toBeCloseTo(150);
    expect(scale('c')).toBeCloseTo(250);
    expect(scale('d')).toBeCloseTo(350);
  });

  it('returns undefined for a key outside the domain', () => {
    const scale = createBandScale(['a', 'b'], [0, 100]);
    expect(scale('z')).toBeUndefined();
  });

  it('shrinks bandwidth as padding increases', () => {
    const tight = createBandScale(['a', 'b'], [0, 100], 0);
    const padded = createBandScale(['a', 'b'], [0, 100], 0.5);
    expect(padded.bandwidth).toBeLessThan(tight.bandwidth);
  });

  it('does not divide by zero for an empty domain', () => {
    const scale = createBandScale([], [0, 100]);
    expect(scale('anything')).toBeUndefined();
    expect(Number.isFinite(scale.bandwidth)).toBe(true);
  });
});

describe('niceTicks', () => {
  it('returns a single tick when min equals max', () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });

  it('normalizes an inverted min/max', () => {
    expect(niceTicks(10, 0)).toEqual(niceTicks(0, 10));
  });

  it('produces round step values, not raw fractions', () => {
    const ticks = niceTicks(0, 97, 5);
    expect(ticks[0]).toBe(0);
    for (let i = 1; i < ticks.length; i++) {
      const step = ticks[i]! - ticks[i - 1]!;
      expect(step).toBeCloseTo(Math.round(step));
    }
  });

  it('covers the full requested domain', () => {
    const ticks = niceTicks(3, 27, 4);
    expect(ticks[0]).toBeLessThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(27);
  });

  it('handles a negative domain', () => {
    const ticks = niceTicks(-50, -10, 4);
    expect(ticks[0]).toBeLessThanOrEqual(-50);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(-10);
  });

  it('does not emit floating point noise like 0.30000000000000004', () => {
    const ticks = niceTicks(0, 1, 10);
    for (const tick of ticks) {
      expect(tick.toString().length).toBeLessThan(10);
    }
  });
});
