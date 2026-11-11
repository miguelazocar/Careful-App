/**
 * Vehicle catalog schema.
 *
 * Source: the Cámara del Comercio Automotor (CCA) price lists for cars, pick-ups, SUVs and vans
 * sold in Argentina — editions 2011, 2016, 2021 and 2026, which together cover model years
 * 1997–2026. `scripts/catalog/` parses them into one JSON per brand in `./brands/`; only names and
 * the years each version was on the market are kept, never prices.
 *
 * Wizard flow: brand → year → models of that year → versions of that model in that year.
 * `years` are model years, inclusive; `null` as the end year means "still on sale".
 */

export type FuelType = 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico';

export type BodyType = 'hatchback' | 'sedan' | 'suv' | 'pickup' | 'van' | 'minivan' | 'coupe' | 'wagon' | 'convertible';

export type Transmission = 'manual' | 'automatica' | 'cvt' | 'dsg';

/** Inclusive model-year range. `null` end = still produced. */
export type YearRange = [from: number, to: number | null];

/* ------------------------------ Stored data ------------------------------ */

/** Compact version entry as stored: [name, first model year, last model year | null]. */
export type CatalogVariantData = [name: string, from: number, to: number | null];

export interface CatalogModelData {
  id: string;
  name: string;
  body: BodyType;
  variants: CatalogVariantData[];
}

export interface CatalogBrandData {
  /** kebab-case, e.g. "mercedes-benz". Persisted in vehicles: never rename. */
  id: string;
  name: string;
  models: CatalogModelData[];
}

/* ------------------------------- Runtime view ------------------------------- */

export interface CatalogOilSpec {
  /** SAE viscosity, e.g. "5W-30". */
  viscosity: string;
  /** Manufacturer / API / ACEA spec, e.g. "VW 508.00", "ACEA C2", "API SN". */
  spec?: string;
  /** Capacity in liters including oil filter. */
  liters: number;
}

export interface CatalogCoolantSpec {
  type: string;
  liters?: number;
  color?: string;
}

/** Engines with fluid data (none in the CCA-based catalog yet; fluids come from the AI). */
export interface CatalogEngine {
  id: string;
  name: string;
  fuel: FuelType;
  oil?: CatalogOilSpec;
  coolant?: CatalogCoolantSpec;
}

export interface CatalogVariant {
  /** Version as listed in Argentina, e.g. "4P 1,3 DRIVE GSE CVT". */
  name: string;
  years: YearRange;
  /** Inferred from the version name ("TDI", "GNC", "HYBRID"…); gasoline when nothing says otherwise. */
  fuel: FuelType;
  /** Only when the name says it (AT, CVT, DSG…). */
  transmission?: Transmission;
  engineId?: string;
}

export interface CatalogModel {
  /** Unique within the brand, kebab-case, e.g. "cronos". Persisted: never rename. */
  id: string;
  name: string;
  body: BodyType;
  years: YearRange;
  variants: CatalogVariant[];
}

export interface CatalogBrand {
  id: string;
  name: string;
  engines: CatalogEngine[];
  models: CatalogModel[];
}
