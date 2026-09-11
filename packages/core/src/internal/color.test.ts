import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_PALETTE, resolveSeriesColor } from './color';

describe('resolveSeriesColor', () => {
  it('prefers an explicit color over the palette', () => {
    expect(resolveSeriesColor(0, '#ff0000')).toBe('#ff0000');
  });

  it('falls back to the default palette by index', () => {
    expect(resolveSeriesColor(0, undefined)).toBe(DEFAULT_COLOR_PALETTE[0]);
    expect(resolveSeriesColor(1, undefined)).toBe(DEFAULT_COLOR_PALETTE[1]);
  });

  it('wraps around when there are more series than palette colors', () => {
    const len = DEFAULT_COLOR_PALETTE.length;
    expect(resolveSeriesColor(len, undefined)).toBe(DEFAULT_COLOR_PALETTE[0]);
    expect(resolveSeriesColor(len + 2, undefined)).toBe(DEFAULT_COLOR_PALETTE[2]);
  });

  it('uses a custom palette when provided', () => {
    expect(resolveSeriesColor(0, undefined, ['#111', '#222'])).toBe('#111');
    expect(resolveSeriesColor(2, undefined, ['#111', '#222'])).toBe('#111');
  });

  it('falls back to the default palette if an empty custom palette is passed', () => {
    expect(resolveSeriesColor(0, undefined, [])).toBe(DEFAULT_COLOR_PALETTE[0]);
  });
});
