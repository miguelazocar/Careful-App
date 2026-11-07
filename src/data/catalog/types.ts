/**
 * Vehicle catalog schema.
 *
 * One JSON file per brand lives in `./brands/<brand-id>.json`.
 * The catalog powers the wizard selector: brand → year → model → variant → color,
 * and the offline "Investigar automáticamente" fluid lookup (oil / coolant).
 *
 * Data rules:
 *  - Market focus: Argentina (plus models commonly sold in the region), year 2000 onwards.
 *  - `years` are model years, inclusive. `null` as the end year means "still on sale".
 *  - Fluid data is optional. When a value is not reliably known it is omitted rather than guessed.
 */

export type FuelType = 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico';

export type BodyType =
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'minivan'
  | 'coupe'
  | 'wagon'
  | 'convertible';

export type Transmission = 'manual' | 'automatica' | 'cvt' | 'dsg';

/** Inclusive model-year range. `null` end = still produced. */
export type YearRange = [from: number, to: number | null];

export interface CatalogOilSpec {
  /** SAE viscosity, e.g. "5W-30". */
  viscosity: string;
  /** Manufacturer / API / ACEA spec, e.g. "VW 508.00", "ACEA C2", "API SN". */
  spec?: string;
  /** Capacity in liters including oil filter. */
  liters: number;
}

export interface CatalogCoolantSpec {
  /** Coolant technology/brand spec, e.g. "Orgánico OAT (G12+)", "Toyota Super Long Life". */
  type: string;
  /** Total system capacity in liters. */
  liters?: number;
  /** Typical color, e.g. "rosa", "verde", "azul". */
  color?: string;
}

export interface CatalogEngine {
  /** Unique within the brand file, kebab-case. e.g. "ea211-1.6-msi". */
  id: string;
  /** Human label, e.g. "1.6 MSI 16v 110 CV". */
  name: string;
  fuel: FuelType;
  oil?: CatalogOilSpec;
  coolant?: CatalogCoolantSpec;
}

export interface CatalogVariant {
  /** Trim + engine label as sold, e.g. "1.3 Drive", "1.8 Precision AT". */
  name: string;
  /** Optional narrower range than the model's range. */
  years?: YearRange;
  /** References `CatalogEngine.id` in the same brand file. */
  engineId?: string;
  transmission?: Transmission;
}

export interface CatalogModel {
  /** Unique within the brand file, kebab-case. e.g. "cronos". */
  id: string;
  name: string;
  body: BodyType;
  years: YearRange;
  variants: CatalogVariant[];
}

export interface CatalogBrand {
  /** kebab-case, e.g. "mercedes-benz". */
  id: string;
  name: string;
  engines: CatalogEngine[];
  models: CatalogModel[];
}
