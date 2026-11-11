/**
 * Combining fluid data from several sources (offline catalog first, then AI) for
 * "Investigar automáticamente". Pure so it can be tested.
 */

export interface FluidData {
  oilType?: string;
  oilLiters?: number;
  coolantType?: string;
  coolantLiters?: number;
  /** Optional extras: base technology, recommended concentration and product. */
  oilBase?: string;
  oilBrand?: string;
  oilModel?: string;
  coolantBase?: string;
  coolantConcentration?: number;
  coolantBrand?: string;
  coolantModel?: string;
  /** Where the data came from, shown to the user. */
  source: string;
  notes?: string;
}

export const FLUID_FIELDS = ['oilType', 'oilLiters', 'coolantType', 'coolantLiters'] as const;
export type FluidField = (typeof FLUID_FIELDS)[number];

/** Filled from the extra source too, but never reported as "missing". */
const EXTRA_FIELDS = ['oilBase', 'oilBrand', 'oilModel', 'coolantBase', 'coolantConcentration', 'coolantBrand', 'coolantModel'] as const;
type AnyField = FluidField | (typeof EXTRA_FIELDS)[number];

const LABELS: Record<FluidField, string> = {
  oilType: 'tipo de aceite',
  oilLiters: 'capacidad de aceite',
  coolantType: 'tipo de refrigerante',
  coolantLiters: 'capacidad de refrigerante',
};

const has = (s: FluidData, k: AnyField) => {
  const v = s[k];
  return typeof v === 'number' ? Number.isFinite(v) && v > 0 : typeof v === 'string' && v.trim().length > 0;
};

export function missingFluidFields(s: FluidData | null | undefined): FluidField[] {
  return FLUID_FIELDS.filter((k) => !s || !has(s, k));
}

/** "capacidad de aceite ni tipo de refrigerante" */
export function describeMissing(fields: FluidField[]): string {
  const words = fields.map((f) => LABELS[f]);
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} ni ${words[words.length - 1]}`;
}

/**
 * The base source wins for every value it has (the curated catalog is preferred); the extra
 * source only fills the gaps. Sources and notes are combined only when the extra one contributed.
 */
export function mergeFluids(base: FluidData | null, extra: FluidData | null): FluidData | null {
  if (!base) return extra && FLUID_FIELDS.some((k) => has(extra, k)) ? extra : null;
  if (!extra) return base;
  const out: FluidData = { ...base };
  let any = false;
  let core = false;
  for (const k of [...FLUID_FIELDS, ...EXTRA_FIELDS]) {
    if (!has(out, k) && has(extra, k)) {
      (out as unknown as Record<AnyField, unknown>)[k] = extra[k];
      any = true;
      if ((FLUID_FIELDS as readonly string[]).includes(k)) core = true;
    }
  }
  if (!any) return base;
  // only the core values make the extra source worth mentioning
  if (core) {
    out.source = `${base.source} + ${extra.source}`;
    out.notes = extra.notes ?? base.notes;
  }
  return out;
}
