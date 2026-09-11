export interface SliceInput {
  id: string;
  label: string;
  value: number;
}

export interface Slice extends SliceInput {
  startAngle: number;
  endAngle: number;
}

/**
 * Converts values into proportional angle spans around a circle, starting
 * at the top (-90deg) and going clockwise.
 */
export function computeSliceAngles(values: SliceInput[]): Slice[] {
  const total = values.reduce((sum, v) => sum + v.value, 0);
  let angle = -Math.PI / 2;
  const slices = values.map((v) => {
    const fraction = total === 0 ? 0 : v.value / total;
    const startAngle = angle;
    const endAngle = angle + fraction * Math.PI * 2;
    angle = endAngle;
    return { ...v, startAngle, endAngle };
  });
  if (slices.length === 1 && slices[0]) {
    // A full-circle sweep is a degenerate SVG arc (start point === end
    // point and renders as nothing) — pull it just short of 360deg.
    slices[0] = { ...slices[0], endAngle: slices[0].startAngle + Math.PI * 2 - 0.0001 };
  }
  return slices;
}

/**
 * Builds an SVG path 'd' for a pie/donut slice. innerRadius > 0 produces a
 * donut segment instead of a solid wedge.
 */
export function buildArcPath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x0 = cx + radius * Math.cos(startAngle);
  const y0 = cy + radius * Math.sin(startAngle);
  const x1 = cx + radius * Math.cos(endAngle);
  const y1 = cy + radius * Math.sin(endAngle);

  if (innerRadius <= 0) {
    return `M ${cx},${cy} L ${x0},${y0} A ${radius},${radius} 0 ${largeArc} 1 ${x1},${y1} Z`;
  }

  const ix0 = cx + innerRadius * Math.cos(startAngle);
  const iy0 = cy + innerRadius * Math.sin(startAngle);
  const ix1 = cx + innerRadius * Math.cos(endAngle);
  const iy1 = cy + innerRadius * Math.sin(endAngle);
  return (
    `M ${ix0},${iy0} L ${x0},${y0} A ${radius},${radius} 0 ${largeArc} 1 ${x1},${y1} ` +
    `L ${ix1},${iy1} A ${innerRadius},${innerRadius} 0 ${largeArc} 0 ${ix0},${iy0} Z`
  );
}
