import { BRAND_DATA, CATALOG_FIRST_YEAR } from './brands';
import type { CatalogBrand, CatalogEngine, CatalogModel, CatalogModelData, CatalogVariant, FuelType, Transmission, YearRange } from './types';

export type { CatalogBrand, CatalogEngine, CatalogModel, CatalogVariant, FuelType } from './types';

export const CATALOG_MIN_YEAR = CATALOG_FIRST_YEAR;

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Fuel from the version name as listed in Argentina ("1,9 TDI", "GNC", "HYBRID"…). */
export function fuelFromVersion(name: string): FuelType {
  const u = ` ${name.toUpperCase()} `;
  if (/\b(ELECTRICO|ELÉCTRICO|ELECTRIC|EV|BEV|E-TECH ELECTRIC)\b/.test(u) && !/\bHEV\b|HYBRID|HIBRID/.test(u)) return 'electrico';
  if (/HYBRID|HIBRID|\bHEV\b|\bPHEV\b|\bMHEV\b|E-TECH/.test(u)) return 'hibrido';
  if (/\bGNC\b/.test(u)) return 'gnc';
  // (a lone "D" is not diesel: "D/C" means doble cabina)
  if (/\b(TDI|TD|TDS|TDCI|HDI|BLUEHDI|DSL|DIESEL|CRDI|JTD|JTDM|MULTIJET|DCI|DID|D-4D|D4D|CDI|BLUETEC|TURBO DIESEL|SD)\b/.test(u)) return 'diesel';
  return 'nafta';
}

export function transmissionFromVersion(name: string): Transmission | undefined {
  const u = ` ${name.toUpperCase()} `;
  if (/\bDSG\b/.test(u)) return 'dsg';
  if (/\bCVT\b|\bIVT\b|\bX-TRONIC\b|\bXTRONIC\b/.test(u)) return 'cvt';
  if (/\b(AT|A\/T|\d?AT\d?|AUT|AUTO|AUTOMATICO|AUTOMATICA|TIPTRONIC|STEPTRONIC|TCT|EDC|DCT|EAT\d?|PDK|S-TRONIC|STRONIC|MULTITRONIC|7G-TRONIC|9G-TRONIC)\b/.test(u)) return 'automatica';
  return undefined;
}

function hydrate(data: CatalogModelData): CatalogModel {
  const variants: CatalogVariant[] = data.variants.map(([name, from, to]) => {
    const transmission = transmissionFromVersion(name);
    return { name, years: [from, to], fuel: fuelFromVersion(name), ...(transmission ? { transmission } : {}) };
  });
  const from = Math.min(...variants.map((v) => v.years[0]));
  const to = variants.some((v) => v.years[1] === null) ? null : Math.max(...variants.map((v) => v.years[1] as number));
  return { id: data.id, name: data.name, body: data.body, years: [from, to], variants };
}

export const BRANDS: CatalogBrand[] = BRAND_DATA.map((b) => ({ id: b.id, name: b.name, engines: [], models: b.models.map(hydrate) })).sort((a, b) =>
  a.name.localeCompare(b.name, 'es'),
);

export function maxCatalogYear(now = new Date()): number {
  return now.getFullYear() + 1;
}

function inRange(range: YearRange, year: number, now = new Date()): boolean {
  const [from, to] = range;
  return year >= from && year <= (to ?? maxCatalogYear(now));
}

export function getBrand(id: string | null | undefined): CatalogBrand | undefined {
  return BRANDS.find((b) => b.id === id);
}

export function getModel(brandId: string | null | undefined, modelId: string | null | undefined): CatalogModel | undefined {
  return getBrand(brandId)?.models.find((m) => m.id === modelId);
}

export function getEngine(brandId: string | null | undefined, engineId: string | null | undefined): CatalogEngine | undefined {
  if (!engineId) return undefined;
  return getBrand(brandId)?.engines.find((e) => e.id === engineId);
}

/** Model years with at least one model on sale, newest first. */
export function yearsForBrand(brandId: string, now = new Date()): number[] {
  const brand = getBrand(brandId);
  if (!brand) return [];
  const years = new Set<number>();
  const max = maxCatalogYear(now);
  // from the versions (not the model's span): a year must lead to at least one version
  for (const m of brand.models) {
    for (const v of m.variants) {
      const from = Math.max(v.years[0], CATALOG_MIN_YEAR);
      const to = Math.min(v.years[1] ?? max, max);
      for (let y = from; y <= to; y++) years.add(y);
    }
  }
  return [...years].sort((a, b) => b - a);
}

/** Models with at least one version in that model year. */
export function modelsFor(brandId: string, year: number | null, now = new Date()): CatalogModel[] {
  const brand = getBrand(brandId);
  if (!brand) return [];
  return brand.models
    .filter((m) => year === null || m.variants.some((v) => inRange(v.years, year, now)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function variantsFor(model: CatalogModel, year: number | null, now = new Date()): CatalogVariant[] {
  return model.variants.filter((v) => year === null || inRange(v.years, year, now));
}

const BRAND_ALIASES: Record<string, string[]> = {
  volkswagen: ['vw', 'volkswagen', 'volks wagen'],
  'mercedes-benz': ['mercedes benz', 'mercedes', 'mb'],
  chevrolet: ['chevrolet', 'chevy', 'gm'],
  citroen: ['citroen'],
  ds: ['ds automobiles', 'ds'],
  mini: ['mini cooper', 'mini'],
  'land-rover': ['land rover', 'landrover'],
  'great-wall': ['great wall', 'gwm'],
  'alfa-romeo': ['alfa romeo', 'alfa'],
};

/** Finds a brand mentioned in free text (OCR, AI output, user input). */
export function matchBrand(text: string): CatalogBrand | undefined {
  const n = ` ${normalizeText(text)} `;
  let best: { brand: CatalogBrand; len: number } | undefined;
  for (const brand of BRANDS) {
    const names = [normalizeText(brand.name), ...(BRAND_ALIASES[brand.id] ?? [])];
    for (const name of names) {
      if (name.length < 2) continue;
      if (n.includes(` ${name} `) && (!best || name.length > best.len)) best = { brand, len: name.length };
    }
  }
  return best?.brand;
}

/** Finds the model of a brand mentioned in free text — longest name wins ("Gol Trend" over "Gol"). */
export function matchModel(brandId: string, text: string): CatalogModel | undefined {
  const brand = getBrand(brandId);
  if (!brand) return undefined;
  const n = ` ${normalizeText(text)} `;
  let best: CatalogModel | undefined;
  for (const m of brand.models) {
    const name = normalizeText(m.name);
    if (name && n.includes(` ${name} `) && (!best || name.length > normalizeText(best.name).length)) best = m;
  }
  return best;
}

/** Best variant match for free text (engine displacement + trim words). */
export function matchVariant(model: CatalogModel, text: string, year: number | null): CatalogVariant | undefined {
  const words = new Set(normalizeText(text).split(' '));
  let best: { v: CatalogVariant; score: number } | undefined;
  for (const v of variantsFor(model, year)) {
    const tokens = normalizeText(v.name).split(' ');
    const score = tokens.filter((t) => words.has(t)).length / tokens.length;
    if (score > 0.5 && (!best || score > best.score)) best = { v, score };
  }
  return best?.v;
}
