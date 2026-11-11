/**
 * Vehicle technical data: fuel, engine oil and coolant options, plus the coolant/water mix.
 * Stored values are stable keys (persisted); labels are what the UI shows.
 */

export type FuelKey = 'gnc' | 'nafta' | 'diesel';
export type OilBase = 'mineral' | 'semisintetico' | 'sintetico';
export type CoolantBase = 'inorganico' | 'organico' | 'hibrido';

export const FUEL_OPTIONS: { value: FuelKey; label: string }[] = [
  { value: 'gnc', label: 'GNC' },
  { value: 'nafta', label: 'Gasolina' },
  { value: 'diesel', label: 'Diésel' },
];

/** Older records may still hold these (catalog engines too). */
const LEGACY_FUEL_LABEL: Record<string, string> = { hibrido: 'Híbrido', electrico: 'Eléctrico' };

export function fuelLabel(fuel: string | null | undefined): string | null {
  if (!fuel) return null;
  return FUEL_OPTIONS.find((f) => f.value === fuel)?.label ?? LEGACY_FUEL_LABEL[fuel] ?? fuel;
}

export const OIL_BASES: { value: OilBase; label: string }[] = [
  { value: 'mineral', label: 'Mineral' },
  { value: 'semisintetico', label: 'Semi-sintético' },
  { value: 'sintetico', label: 'Sintético' },
];

export const COOLANT_BASES: { value: CoolantBase; label: string; hint: string }[] = [
  { value: 'inorganico', label: 'Inorgánico', hint: 'IAT, tradicional' },
  { value: 'organico', label: 'Orgánico', hint: 'OAT, larga duración' },
  { value: 'hibrido', label: 'Híbrido', hint: 'HOAT / Si-OAT' },
];

export const oilBaseLabel = (v: string | null | undefined) => OIL_BASES.find((o) => o.value === v)?.label ?? null;
export const coolantBaseLabel = (v: string | null | undefined) => COOLANT_BASES.find((o) => o.value === v)?.label ?? null;

/** Coolant concentration options (% of coolant; the rest is demineralized water). */
export const COOLANT_CONCENTRATIONS = [30, 40, 50, 60] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * How much concentrate and demineralized water make up the total system capacity.
 * 6 L at 40 % → 2,4 L of coolant + 3,6 L of water.
 */
export function coolantMix(totalLiters: number | null | undefined, percent: number | null | undefined): { coolant: number; water: number } | null {
  if (!totalLiters || totalLiters <= 0 || !percent || percent <= 0 || percent >= 100) return null;
  const coolant = round2((totalLiters * percent) / 100);
  return { coolant, water: round2(totalLiters - coolant) };
}

/**
 * Best guess of the oil base from its SAE grade (editable suggestion, not a fact):
 * 0W/5W are synthetic, 10W usually semi-synthetic, 15W and thicker mineral.
 */
export function guessOilBase(text: string | null | undefined): OilBase | null {
  const m = /(\d{1,2})\s*w/i.exec(text ?? '');
  if (!m) return null;
  const winter = Number(m[1]);
  if (winter <= 5) return 'sintetico';
  if (winter === 10) return 'semisintetico';
  return 'mineral';
}

/** Coolant technology from free text ("OAT · rosa", "G12+", "Inorgánico verde", "HOAT"…). */
export function guessCoolantBase(text: string | null | undefined): CoolantBase | null {
  const t = (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!t.trim()) return null;
  if (/hoat|si-?oat|p-?hoat|hibrid|g12\s*\+\+|g13|g12\s*evo/.test(t)) return 'hibrido';
  if (/inorg|\biat\b|\bg11\b|verde/.test(t)) return 'inorganico';
  if (/\boat\b|organ|\bg12\b|\bg12\s*\+|long life|rosa|rojo/.test(t)) return 'organico';
  return null;
}
