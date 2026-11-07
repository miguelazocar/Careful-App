import citroen from './brands/citroen.json';
import chevrolet from './brands/chevrolet.json';
import ds from './brands/ds.json';
import fiat from './brands/fiat.json';
import ford from './brands/ford.json';
import mercedesBenz from './brands/mercedes-benz.json';
import peugeot from './brands/peugeot.json';
import renault from './brands/renault.json';
import toyota from './brands/toyota.json';
import volkswagen from './brands/volkswagen.json';
import type { CatalogBrand, CatalogEngine, CatalogModel, CatalogVariant, YearRange } from './types';

export type { CatalogBrand, CatalogEngine, CatalogModel, CatalogVariant } from './types';

export const CATALOG_MIN_YEAR = 2000;

export const BRANDS: CatalogBrand[] = (
  [chevrolet, citroen, ds, fiat, ford, mercedesBenz, peugeot, renault, toyota, volkswagen] as unknown as CatalogBrand[]
).sort((a, b) => a.name.localeCompare(b.name, 'es'));

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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
  for (const m of brand.models) {
    const from = Math.max(m.years[0], CATALOG_MIN_YEAR);
    const to = Math.min(m.years[1] ?? max, max);
    for (let y = from; y <= to; y++) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

export function modelsFor(brandId: string, year: number | null, now = new Date()): CatalogModel[] {
  const brand = getBrand(brandId);
  if (!brand) return [];
  return brand.models
    .filter((m) => year === null || inRange(m.years, year, now))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function variantsFor(model: CatalogModel, year: number | null, now = new Date()): CatalogVariant[] {
  return model.variants.filter((v) => year === null || inRange(v.years ?? model.years, year, now));
}

const BRAND_ALIASES: Record<string, string[]> = {
  volkswagen: ['vw', 'volkswagen', 'volks wagen'],
  'mercedes-benz': ['mercedes benz', 'mercedes', 'mb'],
  chevrolet: ['chevrolet', 'chevy', 'gm'],
  citroen: ['citroen'],
  ds: ['ds automobiles', 'ds'],
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
