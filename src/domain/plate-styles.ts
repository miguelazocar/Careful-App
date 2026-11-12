/**
 * License plate designs ("tipo de patente"). The key is persisted in `vehicles.plate_style`:
 * never rename keys, add new ones. Pure — the UI and the PDF draw each `design`.
 */
import { normalizePlate } from './plate';

export type PlateDesign = 'mercosur' | 'ar-1995' | 'cl' | 'pe' | 'eu' | 'generic';

export interface PlateStyle {
  key: string;
  /** Section of the picker. */
  group: 'Mercosur' | 'Sudamérica' | 'Unión Europea' | 'Otros';
  label: string;
  /** ISO country of the plate (formats the characters). */
  country: string;
  design: PlateDesign;
  /** Text on the band: MERCOSUR, the country (Chile, Perú, old Argentine plate) or the EU country code. */
  band: string;
  placeholder: string;
}

const mercosur = (country: string, label: string, placeholder: string): PlateStyle => ({
  key: `mercosur-${country.toLowerCase()}`,
  group: 'Mercosur',
  label,
  country,
  design: 'mercosur',
  band: 'MERCOSUR',
  placeholder,
});

/** EU members and the code on the blue band. */
const EU: [string, string, string][] = [
  ['DE', 'Alemania', 'D'],
  ['AT', 'Austria', 'A'],
  ['BE', 'Bélgica', 'B'],
  ['BG', 'Bulgaria', 'BG'],
  ['CY', 'Chipre', 'CY'],
  ['HR', 'Croacia', 'HR'],
  ['DK', 'Dinamarca', 'DK'],
  ['SK', 'Eslovaquia', 'SK'],
  ['SI', 'Eslovenia', 'SLO'],
  ['ES', 'España', 'E'],
  ['EE', 'Estonia', 'EST'],
  ['FI', 'Finlandia', 'FIN'],
  ['FR', 'Francia', 'F'],
  ['GR', 'Grecia', 'GR'],
  ['HU', 'Hungría', 'H'],
  ['IE', 'Irlanda', 'IRL'],
  ['IT', 'Italia', 'I'],
  ['LV', 'Letonia', 'LV'],
  ['LT', 'Lituania', 'LT'],
  ['LU', 'Luxemburgo', 'L'],
  ['MT', 'Malta', 'M'],
  ['NL', 'Países Bajos', 'NL'],
  ['PL', 'Polonia', 'PL'],
  ['PT', 'Portugal', 'P'],
  ['CZ', 'República Checa', 'CZ'],
  ['RO', 'Rumania', 'RO'],
  ['SE', 'Suecia', 'S'],
];

const EU_PLACEHOLDER: Record<string, string> = { ES: '1234 BCD', FR: 'AB-123-CD', IT: 'AB 123 CD', DE: 'B AB 1234', PT: 'AA-00-AA', NL: 'AB-123-C' };

export const PLATE_STYLES: readonly PlateStyle[] = [
  mercosur('AR', 'Argentina', 'AB 123 CD'),
  mercosur('BR', 'Brasil', 'ABC1D23'),
  mercosur('UY', 'Uruguay', 'ABC 1234'),
  mercosur('PY', 'Paraguay', 'ABCD 123'),
  { key: 'ar-1995', group: 'Mercosur', label: 'Argentina (1995–2016)', country: 'AR', design: 'ar-1995', band: 'ARGENTINA', placeholder: 'ABC 123' },
  { key: 'cl', group: 'Sudamérica', label: 'Chile', country: 'CL', design: 'cl', band: 'CHILE', placeholder: 'BB·CC·12' },
  { key: 'pe', group: 'Sudamérica', label: 'Perú', country: 'PE', design: 'pe', band: 'PERÚ', placeholder: 'ABC-123' },
  ...EU.map(([country, label, band]): PlateStyle => ({ key: `eu-${country.toLowerCase()}`, group: 'Unión Europea', label, country, design: 'eu', band, placeholder: EU_PLACEHOLDER[country] ?? 'AB 123 CD' })),
  { key: 'otro', group: 'Otros', label: 'Otro país', country: 'XX', design: 'generic', band: '', placeholder: 'ABC 123' },
];

export const PLATE_GROUPS = ['Mercosur', 'Sudamérica', 'Unión Europea', 'Otros'] as const;

export function findPlateStyle(key: string | null | undefined): PlateStyle | undefined {
  return key ? PLATE_STYLES.find((s) => s.key === key) : undefined;
}

const AR_OLD = /^[A-Z]{3}\d{3}$/;

/**
 * The design to draw: the one the user chose, else one deduced for vehicles saved before plate
 * types existed (an Argentine "ABC 123" is the 1995 black plate; other countries map by code).
 */
export function resolvePlateStyle(v: { plateStyle?: string | null; country?: string | null; plate?: string | null }): PlateStyle {
  const chosen = findPlateStyle(v.plateStyle);
  if (chosen) return chosen;
  const country = (v.country ?? 'AR').toUpperCase();
  if (country === 'AR' && AR_OLD.test(normalizePlate(v.plate))) return findPlateStyle('ar-1995')!;
  return PLATE_STYLES.find((s) => s.country === country && s.key !== 'ar-1995') ?? findPlateStyle('otro')!;
}

/** Country name for a plate country code ("Austria" for AT), or null when unknown ("XX"). */
export function plateCountryName(code: string | null | undefined): string | null {
  const style = PLATE_STYLES.find((s) => s.country === code?.toUpperCase() && s.design !== 'ar-1995' && s.design !== 'generic');
  return style?.label ?? null;
}

/** Characters as printed on that plate ("BB·CC·12" on Chilean ones). */
export function plateText(style: PlateStyle, formatted: string): string {
  return style.design === 'cl' ? formatted.replace(/\s+/g, '·') : formatted;
}
