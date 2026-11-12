/**
 * Minimal async SQLite contract used by the repositories.
 * `expo-sqlite`'s SQLiteDatabase satisfies it in the app; tests use a `node:sqlite` adapter.
 */
export type SqlParam = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Domain entities (camelCase, as used by the app)                     */
/* ------------------------------------------------------------------ */

export type RecordKind = 'maintenance' | 'accessory' | 'odometer';

export interface Vehicle {
  id: string;
  nickname: string | null;
  brand: string;
  brandId: string | null;
  model: string;
  modelId: string | null;
  year: number | null;
  variant: string | null;
  engineId: string | null;
  fuel: string | null;
  color: string | null;
  colorHex: string | null;
  plate: string | null;
  country: string;
  /** "Tipo de patente": a PlateStyle key (domain/plate-styles.ts); null = deduced from the country. */
  plateStyle: string | null;
  vin: string | null;
  engineNumber: string | null;
  /** Relative path inside the app documents directory (e.g. "photos/abc.jpg"). */
  photo: string | null;
  initialOdometer: number;
  /** Mineral / semi-sintético / sintético (domain/vehicle-specs OilBase). */
  oilBase: string | null;
  oilBrand: string | null;
  oilModel: string | null;
  /** "Versión" of the oil: SAE grade and spec, e.g. "5W-30 · ACEA C2". */
  oilType: string | null;
  oilLiters: number | null;
  /** Inorgánico / orgánico / híbrido (domain/vehicle-specs CoolantBase). */
  coolantBase: string | null;
  coolantBrand: string | null;
  coolantModel: string | null;
  /** "Versión" of the coolant: spec / color, e.g. "G12+ · rosa". */
  coolantType: string | null;
  /** Total system capacity (concentrate + water). */
  coolantLiters: number | null;
  /** % of concentrate in the mix (30, 40, 50 or 60); the rest is demineralized water. */
  coolantConcentration: number | null;
  notes: string | null;
  sortOrder: number;
  /** Set when the car is no longer in use (sold, stolen…): hidden from the garage and reminders. */
  archivedAt: string | null;
  /** Why it was archived: an ArchiveReason key (domain/archive.ts). */
  archivedReason: string | null;
  /** Optional detail, e.g. "Vendido a Juan Pérez". */
  archivedNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordItem {
  id: string;
  recordId: string;
  category: string;
  item: string;
  label: string;
  /** Next service after this one: every N km / N months (null = the vehicle's plan). */
  intervalKm: number | null;
  intervalMonths: number | null;
}

export interface RecordPhoto {
  id: string;
  recordId: string;
  /** Relative path inside the app documents directory. */
  path: string;
  sortOrder: number;
}

export interface LogRecord {
  id: string;
  vehicleId: string;
  kind: RecordKind;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  odometer: number | null;
  /** Amount in cents (no currency — the app is currency-agnostic). */
  amountCents: number | null;
  workshop: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogRecordFull extends LogRecord {
  items: RecordItem[];
  photos: RecordPhoto[];
}

export interface ServiceRule {
  vehicleId: string;
  item: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  enabled: boolean;
}

export interface ManualReminder {
  id: string;
  vehicleId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  dueOdometer: number | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}
