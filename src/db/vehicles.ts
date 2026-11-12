import { newId, nowIso } from '@/lib/id';

import { getDb, notifyDataChanged } from './connection';
import type { SqlParam, Vehicle } from './types';

interface VehicleRow {
  id: string;
  nickname: string | null;
  brand: string;
  brand_id: string | null;
  model: string;
  model_id: string | null;
  year: number | null;
  variant: string | null;
  engine_id: string | null;
  fuel: string | null;
  color: string | null;
  color_hex: string | null;
  plate: string | null;
  country: string;
  plate_style: string | null;
  vin: string | null;
  engine_number: string | null;
  photo: string | null;
  initial_odometer: number;
  oil_base: string | null;
  oil_brand: string | null;
  oil_model: string | null;
  oil_type: string | null;
  oil_liters: number | null;
  coolant_base: string | null;
  coolant_brand: string | null;
  coolant_model: string | null;
  coolant_type: string | null;
  coolant_liters: number | null;
  coolant_concentration: number | null;
  notes: string | null;
  sort_order: number;
  archived_at: string | null;
  archived_reason: string | null;
  archived_note: string | null;
  created_at: string;
  updated_at: string;
}

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'archivedAt' | 'archivedReason' | 'archivedNote'> & {
  sortOrder?: number;
};

const COLUMNS: [keyof VehicleInput, string][] = [
  ['nickname', 'nickname'],
  ['brand', 'brand'],
  ['brandId', 'brand_id'],
  ['model', 'model'],
  ['modelId', 'model_id'],
  ['year', 'year'],
  ['variant', 'variant'],
  ['engineId', 'engine_id'],
  ['fuel', 'fuel'],
  ['color', 'color'],
  ['colorHex', 'color_hex'],
  ['plate', 'plate'],
  ['country', 'country'],
  ['plateStyle', 'plate_style'],
  ['vin', 'vin'],
  ['engineNumber', 'engine_number'],
  ['photo', 'photo'],
  ['initialOdometer', 'initial_odometer'],
  ['oilBase', 'oil_base'],
  ['oilBrand', 'oil_brand'],
  ['oilModel', 'oil_model'],
  ['oilType', 'oil_type'],
  ['oilLiters', 'oil_liters'],
  ['coolantBase', 'coolant_base'],
  ['coolantBrand', 'coolant_brand'],
  ['coolantModel', 'coolant_model'],
  ['coolantType', 'coolant_type'],
  ['coolantLiters', 'coolant_liters'],
  ['coolantConcentration', 'coolant_concentration'],
  ['notes', 'notes'],
];

export function mapVehicle(r: VehicleRow): Vehicle {
  return {
    id: r.id,
    nickname: r.nickname,
    brand: r.brand,
    brandId: r.brand_id,
    model: r.model,
    modelId: r.model_id,
    year: r.year,
    variant: r.variant,
    engineId: r.engine_id,
    fuel: r.fuel,
    color: r.color,
    colorHex: r.color_hex,
    plate: r.plate,
    country: r.country,
    plateStyle: r.plate_style ?? null,
    vin: r.vin,
    engineNumber: r.engine_number,
    photo: r.photo,
    initialOdometer: r.initial_odometer,
    oilBase: r.oil_base,
    oilBrand: r.oil_brand,
    oilModel: r.oil_model,
    oilType: r.oil_type,
    oilLiters: r.oil_liters,
    coolantBase: r.coolant_base,
    coolantBrand: r.coolant_brand,
    coolantModel: r.coolant_model,
    coolantType: r.coolant_type,
    coolantLiters: r.coolant_liters,
    coolantConcentration: r.coolant_concentration,
    notes: r.notes,
    sortOrder: r.sort_order,
    archivedAt: r.archived_at,
    archivedReason: r.archived_reason,
    archivedNote: r.archived_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listVehicles(opts: { includeArchived?: boolean } = {}): Promise<Vehicle[]> {
  const rows = await getDb().getAllAsync<VehicleRow>(
    `SELECT * FROM vehicles ${opts.includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(mapVehicle);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const row = await getDb().getFirstAsync<VehicleRow>('SELECT * FROM vehicles WHERE id = ?', [id]);
  return row ? mapVehicle(row) : null;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  const maxOrder = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM vehicles');
  const sortOrder = input.sortOrder ?? (maxOrder?.m ?? -1) + 1;
  const cols = COLUMNS.map(([, c]) => c);
  const values: SqlParam[] = COLUMNS.map(([k]) => (input[k] ?? null) as SqlParam);
  await db.runAsync(
    `INSERT INTO vehicles (id, ${cols.join(', ')}, sort_order, created_at, updated_at)
     VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?, ?)`,
    [id, ...values, sortOrder, now, now],
  );
  notifyDataChanged();
  return (await getVehicle(id))!;
}

export async function updateVehicle(id: string, patch: Partial<VehicleInput>): Promise<Vehicle> {
  const entries = COLUMNS.filter(([k]) => k in patch);
  if (entries.length) {
    await getDb().runAsync(
      `UPDATE vehicles SET ${entries.map(([, c]) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      [...entries.map(([k]) => (patch[k] ?? null) as SqlParam), nowIso(), id],
    );
    notifyDataChanged();
  }
  return (await getVehicle(id))!;
}

/**
 * Archives a vehicle with the reason it is no longer in use (`null` restores it to the garage).
 * Archived vehicles keep their whole history but leave the garage, the agenda and the reminders.
 */
export async function setVehicleArchived(id: string, archive: { reason: string; note?: string | null } | null): Promise<void> {
  await getDb().runAsync('UPDATE vehicles SET archived_at = ?, archived_reason = ?, archived_note = ?, updated_at = ? WHERE id = ?', [
    archive ? nowIso() : null,
    archive?.reason ?? null,
    archive?.note?.trim() || null,
    nowIso(),
    id,
  ]);
  notifyDataChanged();
}

/**
 * Deletes the vehicle and (via ON DELETE CASCADE) its records, photos, rules and reminders.
 * Returns every photo path that belonged to it so the caller can remove the files.
 */
export async function deleteVehicle(id: string): Promise<string[]> {
  const db = getDb();
  const vehicle = await getVehicle(id);
  const photos = await db.getAllAsync<{ path: string }>(
    `SELECT p.path FROM record_photos p JOIN records r ON r.id = p.record_id WHERE r.vehicle_id = ?`,
    [id],
  );
  await db.runAsync('DELETE FROM vehicles WHERE id = ?', [id]);
  notifyDataChanged();
  return [...(vehicle?.photo ? [vehicle.photo] : []), ...photos.map((p) => p.path)];
}

export async function reorderVehicles(orderedIds: string[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE vehicles SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  });
  notifyDataChanged();
}
