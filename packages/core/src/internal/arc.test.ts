import { describe, expect, it } from 'vitest';
import { buildArcPath, computeSliceAngles } from './arc';

describe('computeSliceAngles', () => {
  it('splits two equal values into two half-circle spans', () => {
    const slices = computeSliceAngles([
      { id: 'a', label: 'A', value: 1 },
      { id: 'b', label: 'B', value: 1 },
    ]);
    expect(slices[0]!.startAngle).toBeCloseTo(-Math.PI / 2);
    expect(slices[0]!.endAngle - slices[0]!.startAngle).toBeCloseTo(Math.PI);
    expect(slices[1]!.startAngle).toBeCloseTo(slices[0]!.endAngle);
    expect(slices[1]!.endAngle - slices[1]!.startAngle).toBeCloseTo(Math.PI);
  });

  it('gives a value-proportional angle span', () => {
    const slices = computeSliceAngles([
      { id: 'a', label: 'A', value: 3 },
      { id: 'b', label: 'B', value: 1 },
    ]);
    const spanA = slices[0]!.endAngle - slices[0]!.startAngle;
    const spanB = slices[1]!.endAngle - slices[1]!.startAngle;
    expect(spanA / spanB).toBeCloseTo(3);
  });

  it('pulls a single full-circle slice just short of 360deg to avoid a degenerate arc', () => {
    const slices = computeSliceAngles([{ id: 'a', label: 'A', value: 5 }]);
    const span = slices[0]!.endAngle - slices[0]!.startAngle;
    expect(span).toBeLessThan(Math.PI * 2);
    expect(span).toBeGreaterThan(Math.PI * 2 - 0.01);
  });

  it('does not divide by zero when every value is zero', () => {
    const slices = computeSliceAngles([
      { id: 'a', label: 'A', value: 0 },
      { id: 'b', label: 'B', value: 0 },
    ]);
    for (const slice of slices) {
      expect(Number.isFinite(slice.startAngle)).toBe(true);
      expect(Number.isFinite(slice.endAngle)).toBe(true);
    }
  });
});

describe('buildArcPath', () => {
  it('starts at the center and ends closed for a solid wedge', () => {
    const d = buildArcPath(50, 50, 40, 0, -Math.PI / 2, 0);
    expect(d.startsWith('M 50,50')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('sets the large-arc-flag for a sweep greater than 180deg', () => {
    const d = buildArcPath(0, 0, 10, 0, 0, Math.PI * 1.5);
    expect(d).toContain('10,10 0 1 1');
  });

  it('clears the large-arc-flag for a sweep of 180deg or less', () => {
    const d = buildArcPath(0, 0, 10, 0, 0, Math.PI / 2);
    expect(d).toContain('10,10 0 0 1');
  });

  it('produces a two-arc donut segment when innerRadius is set', () => {
    const d = buildArcPath(0, 0, 10, 5, 0, Math.PI / 2);
    const arcCount = d.match(/A /g)?.length ?? 0;
    expect(arcCount).toBe(2);
  });
});
