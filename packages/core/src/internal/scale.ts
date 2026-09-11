export type Scale = (value: number) => number;

export function createLinearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const domainSpan = d1 - d0;
  if (domainSpan === 0) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  return (value: number) => r0 + ((value - d0) / domainSpan) * (r1 - r0);
}

export interface BandScale {
  (key: string): number | undefined;
  bandwidth: number;
  domain: string[];
}

export function createBandScale(
  domain: string[],
  range: [number, number],
  paddingRatio = 0.2,
): BandScale {
  const [r0, r1] = range;
  const span = r1 - r0;
  const step = domain.length > 0 ? span / domain.length : 0;
  const bandwidth = Math.max(0, step * (1 - paddingRatio));
  const offset = (step - bandwidth) / 2;
  const positions = new Map<string, number>();
  domain.forEach((key, i) => {
    positions.set(key, r0 + step * i + offset + bandwidth / 2);
  });
  const scale = ((key: string) => positions.get(key)) as BandScale;
  scale.bandwidth = bandwidth;
  scale.domain = domain;
  return scale;
}

/**
 * "Nice" round tick values for a linear domain (classic min/max-rounding
 * approach) so axis labels read as 0, 25, 50... instead of 0, 24.5, 49.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    return [min];
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  const step = niceNumber((max - min) / Math.max(1, count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(roundToStep(v, step));
  }
  return ticks;
}

function niceNumber(value: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

function roundToStep(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  // Avoid floating point noise like 0.30000000000000004 in tick labels.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 6);
  return Number(rounded.toFixed(decimals));
}
