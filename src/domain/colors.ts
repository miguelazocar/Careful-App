export interface VehicleColor {
  name: string;
  hex: string;
}

/** Most common factory colors in the region, ordered by popularity. */
export const VEHICLE_COLORS: VehicleColor[] = [
  { name: 'Blanco', hex: '#F5F6F8' },
  { name: 'Gris plata', hex: '#B8BEC6' },
  { name: 'Gris oscuro', hex: '#5A6068' },
  { name: 'Negro', hex: '#1B1D21' },
  { name: 'Rojo', hex: '#C62B2B' },
  { name: 'Azul', hex: '#1F4FA8' },
  { name: 'Azul oscuro', hex: '#1A2A4F' },
  { name: 'Celeste', hex: '#6FB4E0' },
  { name: 'Verde', hex: '#2F6B45' },
  { name: 'Beige', hex: '#D8C8A8' },
  { name: 'Marrón', hex: '#6B4A32' },
  { name: 'Bordó', hex: '#6E1A2A' },
  { name: 'Naranja', hex: '#E6732A' },
  { name: 'Amarillo', hex: '#E9C33B' },
  { name: 'Dorado', hex: '#C2A15A' },
  { name: 'Violeta', hex: '#5B3F8C' },
];

export function colorHexFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const exact = VEHICLE_COLORS.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.hex;
  const partial = VEHICLE_COLORS.find((c) => n.includes(c.name.toLowerCase().split(' ')[0]));
  return partial?.hex ?? null;
}

/** Relative luminance check used to pick readable foregrounds over a car color swatch. */
export function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}
