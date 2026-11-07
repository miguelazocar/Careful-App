import { newId, nowIso } from '@/lib/id';

import { getDb, notifyDataChanged } from './connection';
import type { ManualReminder, ServiceRule } from './types';

/* ----------------------------- Service rules ----------------------------- */

interface RuleRow {
  vehicle_id: string;
  item: string;
  interval_km: number | null;
  interval_months: number | null;
  enabled: number;
}

const mapRule = (r: RuleRow): ServiceRule => ({
  vehicleId: r.vehicle_id,
  item: r.item,
  intervalKm: r.interval_km,
  intervalMonths: r.interval_months,
  enabled: r.enabled === 1,
});

export async function getServiceRules(vehicleId?: string): Promise<ServiceRule[]> {
  const rows = vehicleId
    ? await getDb().getAllAsync<RuleRow>('SELECT * FROM service_rules WHERE vehicle_id = ?', [vehicleId])
    : await getDb().getAllAsync<RuleRow>('SELECT * FROM service_rules');
  return rows.map(mapRule);
}

export async function saveServiceRule(rule: ServiceRule): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO service_rules (vehicle_id, item, interval_km, interval_months, enabled)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(vehicle_id, item) DO UPDATE SET
       interval_km = excluded.interval_km,
       interval_months = excluded.interval_months,
       enabled = excluded.enabled`,
    [rule.vehicleId, rule.item, rule.intervalKm, rule.intervalMonths, rule.enabled ? 1 : 0],
  );
  notifyDataChanged();
}

export async function resetServiceRule(vehicleId: string, item: string): Promise<void> {
  await getDb().runAsync('DELETE FROM service_rules WHERE vehicle_id = ? AND item = ?', [vehicleId, item]);
  notifyDataChanged();
}

/* ---------------------------- Manual reminders ---------------------------- */

interface ReminderRow {
  id: string;
  vehicle_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_odometer: number | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapReminder = (r: ReminderRow): ManualReminder => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  title: r.title,
  notes: r.notes,
  dueDate: r.due_date,
  dueOdometer: r.due_odometer,
  doneAt: r.done_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ReminderInput = Pick<ManualReminder, 'vehicleId' | 'title' | 'notes' | 'dueDate' | 'dueOdometer'>;

export async function listManualReminders(opts: { includeDone?: boolean; vehicleId?: string } = {}): Promise<ManualReminder[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (!opts.includeDone) where.push('done_at IS NULL');
  if (opts.vehicleId) {
    where.push('vehicle_id = ?');
    params.push(opts.vehicleId);
  }
  const rows = await getDb().getAllAsync<ReminderRow>(
    `SELECT * FROM reminders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY COALESCE(due_date, '9999') ASC`,
    params,
  );
  return rows.map(mapReminder);
}

export async function getManualReminder(id: string): Promise<ManualReminder | null> {
  const row = await getDb().getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE id = ?', [id]);
  return row ? mapReminder(row) : null;
}

export async function createManualReminder(input: ReminderInput): Promise<ManualReminder> {
  const id = newId();
  const now = nowIso();
  await getDb().runAsync(
    `INSERT INTO reminders (id, vehicle_id, title, notes, due_date, due_odometer, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.vehicleId, input.title, input.notes, input.dueDate, input.dueOdometer, now, now],
  );
  notifyDataChanged();
  return (await getManualReminder(id))!;
}

export async function updateManualReminder(id: string, input: ReminderInput): Promise<void> {
  await getDb().runAsync(
    `UPDATE reminders SET vehicle_id = ?, title = ?, notes = ?, due_date = ?, due_odometer = ?, updated_at = ? WHERE id = ?`,
    [input.vehicleId, input.title, input.notes, input.dueDate, input.dueOdometer, nowIso(), id],
  );
  notifyDataChanged();
}

export async function setManualReminderDone(id: string, done: boolean): Promise<void> {
  await getDb().runAsync('UPDATE reminders SET done_at = ?, updated_at = ? WHERE id = ?', [
    done ? nowIso() : null,
    nowIso(),
    id,
  ]);
  notifyDataChanged();
}

export async function deleteManualReminder(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  notifyDataChanged();
}

/* ---------------------------- Notification log ---------------------------- */

export async function wasNotified(key: string): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ key: string }>('SELECT key FROM notification_log WHERE key = ?', [key]);
  return !!row;
}

export async function markNotified(key: string): Promise<void> {
  await getDb().runAsync('INSERT OR REPLACE INTO notification_log (key, sent_at) VALUES (?, ?)', [key, nowIso()]);
}
