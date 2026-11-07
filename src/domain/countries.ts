export interface Country {
  code: string;
  name: string;
  /** Uses the Mercosur plate design (blue top band). */
  mercosur?: boolean;
}

export const COUNTRIES: Country[] = [
  { code: 'AR', name: 'Argentina', mercosur: true },
  { code: 'UY', name: 'Uruguay', mercosur: true },
  { code: 'BR', name: 'Brasil', mercosur: true },
  { code: 'PY', name: 'Paraguay', mercosur: true },
  { code: 'CL', name: 'Chile' },
  { code: 'BO', name: 'Bolivia', mercosur: true },
  { code: 'PE', name: 'Perú' },
  { code: 'CO', name: 'Colombia' },
  { code: 'VE', name: 'Venezuela', mercosur: true },
  { code: 'EC', name: 'Ecuador' },
  { code: 'MX', name: 'México' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'IT', name: 'Italia' },
  { code: 'DE', name: 'Alemania' },
  { code: 'FR', name: 'Francia' },
];

export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🏳️';
  const base = 0x1f1e6;
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => base + c.charCodeAt(0) - 65));
}

export function findCountry(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code?.toUpperCase());
}

export function countryName(code: string): string {
  return findCountry(code)?.name ?? code.toUpperCase();
}
