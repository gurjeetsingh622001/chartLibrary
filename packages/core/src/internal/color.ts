export const DEFAULT_COLOR_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

export function resolveSeriesColor(
  index: number,
  explicitColor: string | undefined,
  palette: string[] = DEFAULT_COLOR_PALETTE,
): string {
  if (explicitColor) {
    return explicitColor;
  }
  const safePalette = palette.length > 0 ? palette : DEFAULT_COLOR_PALETTE;
  return safePalette[index % safePalette.length]!;
}
