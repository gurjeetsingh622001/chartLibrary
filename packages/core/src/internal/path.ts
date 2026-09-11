export interface PixelPoint {
  x: number;
  y: number;
}

export type LineCurve = 'linear' | 'monotone' | 'step';

export function buildLinePath(points: PixelPoint[], curve: LineCurve = 'linear'): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0]!.x},${points[0]!.y}`;
  }
  if (curve === 'step') {
    return buildStepPath(points);
  }
  if (curve === 'monotone') {
    return buildMonotonePath(points);
  }
  return buildLinearPath(points);
}

function buildLinearPath(points: PixelPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

function buildStepPath(points: PixelPoint[]): string {
  let d = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const curr = points[i]!;
    d += ` H ${curr.x} V ${curr.y}`;
  }
  return d;
}

/**
 * Simplified monotone cubic interpolation: per-point tangents from
 * neighboring secant slopes (zeroed at local extrema to avoid overshoot
 * past the data), rendered as cubic Bezier segments. Not a full
 * Fritsch-Carlson implementation, but keeps the curve from swinging wildly
 * past its data points the way a plain Catmull-Rom spline can.
 */
function buildMonotonePath(points: PixelPoint[]): string {
  const n = points.length;
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x;
    const dy = points[i + 1]!.y - points[i]!.y;
    secants.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = secants[0] ?? 0;
  tangents[n - 1] = secants[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const prev = secants[i - 1]!;
    const next = secants[i]!;
    tangents[i] = prev * next <= 0 ? 0 : (prev + next) / 2;
  }

  let d = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const dx = (p1.x - p0.x) / 3;
    const cp1x = p0.x + dx;
    const cp1y = p0.y + tangents[i]! * dx;
    const cp2x = p1.x - dx;
    const cp2y = p1.y - tangents[i + 1]! * dx;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}
