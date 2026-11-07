/**
 * VIN (chasis / carrocería) helpers — ISO 3779.
 * Logic note: in the original spec "serial de chasis" and "serial de carrocería" were separate
 * fields, but both refer to the same identifier (VIN). Careful stores the VIN once and adds the
 * engine number ("N° de motor"), which is what the Argentine "cédula verde" actually lists.
 */

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(raw: string | null | undefined): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IQ]/g, (c) => (c === 'I' ? '1' : '0'));
}

export function isValidVin(raw: string): boolean {
  return VIN_RE.test(normalizeVin(raw));
}

/**
 * 10th character → model year. Codes repeat every 30 years:
 * Y=2000, 1..9=2001..2009, A=2010 … W=2028, X=2029 (and 1999 when 2029 is in the future).
 */
const YEAR_ORDER = 'Y123456789ABCDEFGHJKLMNPRSTVWX';
export function vinModelYear(vin: string, maxYear = new Date().getFullYear() + 1): number | null {
  const v = normalizeVin(vin);
  if (v.length !== 17) return null;
  const idx = YEAR_ORDER.indexOf(v[9]);
  if (idx < 0) return null;
  let year = 2000 + idx;
  // codes repeat every 30 years; keep within plausible range
  while (year > maxYear) year -= 30;
  return year >= 1980 ? year : null;
}

/** World Manufacturer Identifier → catalog brand id. Covers plants that supply the region. */
const WMI_BRANDS: [prefix: string, brandId: string][] = [
  // Argentina
  ['8AF', 'ford'],
  ['8AG', 'chevrolet'],
  ['8AW', 'volkswagen'],
  ['8AJ', 'toyota'],
  ['8AP', 'fiat'],
  ['8AD', 'peugeot'],
  ['8BC', 'citroen'],
  ['8A1', 'renault'],
  ['8AC', 'mercedes-benz'],
  // Brazil
  ['9BF', 'ford'],
  ['9BG', 'chevrolet'],
  ['9BW', 'volkswagen'],
  ['9BR', 'toyota'],
  ['9BD', 'fiat'],
  ['935', 'citroen'],
  ['936', 'peugeot'],
  ['93Y', 'renault'],
  ['9BM', 'mercedes-benz'],
  ['93U', 'volkswagen'],
  ['8C3', 'chevrolet'],
  // Mexico / USA
  ['3FA', 'ford'],
  ['3VW', 'volkswagen'],
  ['3GN', 'chevrolet'],
  ['1FT', 'ford'],
  ['1FA', 'ford'],
  // Europe / Asia
  ['WVW', 'volkswagen'],
  ['WVG', 'volkswagen'],
  ['WV1', 'volkswagen'],
  ['WV2', 'volkswagen'],
  ['WF0', 'ford'],
  ['WDD', 'mercedes-benz'],
  ['WDB', 'mercedes-benz'],
  ['WDC', 'mercedes-benz'],
  ['W1K', 'mercedes-benz'],
  ['W1N', 'mercedes-benz'],
  ['VF3', 'peugeot'],
  ['VF7', 'citroen'],
  ['VR1', 'ds'],
  ['VF1', 'renault'],
  ['ZFA', 'fiat'],
  ['JTD', 'toyota'],
  ['JTE', 'toyota'],
  ['JTM', 'toyota'],
  ['JTN', 'toyota'],
  ['MR0', 'toyota'],
  ['MHF', 'toyota'],
  ['KL1', 'chevrolet'],
];

export function vinBrandId(vin: string): string | null {
  const v = normalizeVin(vin);
  if (v.length < 3) return null;
  const hit = WMI_BRANDS.find(([p]) => v.startsWith(p));
  return hit?.[1] ?? null;
}

/** Finds 17-char VIN candidates inside OCR text. */
export function findVinsInText(text: string): string[] {
  const out = new Set<string>();
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\n]/g, ' ');
  for (const line of cleaned.split('\n')) {
    const compact = line.replace(/\s+/g, '');
    for (let i = 0; i + 17 <= compact.length; i++) {
      const cand = normalizeVin(compact.slice(i, i + 17));
      if (VIN_RE.test(cand) && /[A-Z]/.test(cand) && /\d{4,}/.test(cand) && vinBrandId(cand)) out.add(cand);
    }
    for (const word of line.split(/\s+/)) {
      const cand = normalizeVin(word);
      if (VIN_RE.test(cand) && /[A-Z]/.test(cand) && /\d/.test(cand)) out.add(cand);
    }
  }
  return [...out];
}
