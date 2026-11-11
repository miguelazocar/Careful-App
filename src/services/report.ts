import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { listRecords } from '@/db/records';
import type { LogRecordFull, Vehicle } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import { countryName, flagEmoji } from '@/domain/countries';
import { findItem } from '@/domain/maintenance';
import { formatPlate } from '@/domain/plate';
import { coolantBaseLabel, fuelLabel, oilBaseLabel } from '@/domain/vehicle-specs';
import { formatDay, today } from '@/lib/dates';
import { formatAmount, formatKm } from '@/lib/format';
import { withExternalActivity } from '@/stores/ui';

import { photoUri } from './photos';
import { loadUpcoming, vehicleLabel } from './upcoming';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);


const KIND_LABEL: Record<string, string> = {
  maintenance: 'Mantenimiento',
  accessory: 'Accesorio',
  odometer: 'Kilometraje',
};

function recordTitle(r: LogRecordFull): string {
  if (r.kind === 'odometer') return 'Actualización de kilometraje';
  const labels = r.items.map((i) => (i.item.endsWith('.otro') ? i.label : findItem(i.item)?.item.label ?? i.label));
  return labels.join(', ') || KIND_LABEL[r.kind];
}

async function coverDataUri(v: Vehicle): Promise<string | null> {
  const uri = photoUri(v.photo);
  if (!uri) return null;
  try {
    const f = new File(uri);
    if (!f.exists) return null;
    return `data:image/jpeg;base64,${await f.base64()}`;
  } catch {
    return null;
  }
}

export async function buildVehicleReportHtml(vehicleId: string): Promise<string> {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) throw new Error('Vehículo no encontrado');
  const records = await listRecords({ vehicleId });
  const { items, snapshots } = await loadUpcoming({ vehicleId });
  const snap = snapshots.get(vehicleId);
  const total = records.reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const cover = await coverDataUri(vehicle);

  const rows = records
    .map(
      (r) => `<tr>
        <td class="nowrap">${esc(formatDay(r.date))}</td>
        <td><b>${esc(recordTitle(r))}</b>${r.description ? `<div class="muted">${esc(r.description).replace(/\n/g, '<br/>')}</div>` : ''}${r.workshop ? `<div class="muted">Taller: ${esc(r.workshop)}</div>` : ''}</td>
        <td class="nowrap right">${r.odometer !== null ? esc(formatKm(r.odometer)) : '—'}</td>
        <td class="nowrap right">${r.amountCents !== null ? esc(formatAmount(r.amountCents)) : '—'}</td>
      </tr>`,
    )
    .join('');

  const upcoming = items
    .slice(0, 8)
    .map(
      (i) => `<li><b>${esc(i.title)}</b> — ${i.due.effectiveDate ? esc(formatDay(i.due.effectiveDate)) : ''}${
        i.due.dueKm ? ` · ${esc(formatKm(i.due.dueKm))}` : ''
      }</li>`,
    )
    .join('');

  const field = (label: string, value: string | number | null | undefined) =>
    value !== null && value !== undefined && value !== '' ? `<div class="field"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; color: #141C2B; margin: 28px; font-size: 12px; }
    .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .brand .car { color: #0B63F6; font-style: italic; } .brand .tail { color: #1D2633; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0B63F6; padding-bottom: 10px; }
    .muted { color: #5F6E85; font-size: 11px; margin-top: 2px; }
    h1 { font-size: 22px; margin: 18px 0 4px; } h2 { font-size: 14px; margin: 22px 0 8px; color: #0547C9; text-transform: uppercase; letter-spacing: 1px; }
    .hero { display: flex; gap: 18px; align-items: center; }
    .hero img { width: 220px; height: 140px; object-fit: cover; border-radius: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin-top: 8px; }
    .field span { display: block; color: #5F6E85; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
    .stats { display: flex; gap: 12px; margin-top: 14px; }
    .stat { flex: 1; background: #EEF4FF; border-radius: 10px; padding: 10px 12px; }
    .stat b { display: block; font-size: 18px; color: #0547C9; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #5F6E85; border-bottom: 1px solid #E1E7F0; padding: 6px; }
    td { border-bottom: 1px solid #EEF1F6; padding: 8px 6px; vertical-align: top; }
    .right { text-align: right; } .nowrap { white-space: nowrap; }
    .foot { margin-top: 24px; color: #94A0B4; font-size: 10px; text-align: center; }
  </style></head><body>
    <div class="hdr"><div class="brand"><span class="car">Car</span><span class="tail">eful</span></div>
    <div class="muted">Historial del vehículo · ${esc(formatDay(today()))}</div></div>
    <div class="hero">
      ${cover ? `<img src="${cover}"/>` : ''}
      <div>
        <h1>${esc(vehicleLabel(vehicle))}</h1>
        <div class="muted">${esc([vehicle.brand, vehicle.model, vehicle.variant, vehicle.year].filter(Boolean).join(' · '))}</div>
        <div class="grid">
          ${field('Patente', vehicle.plate ? `${flagEmoji(vehicle.country)} ${formatPlate(vehicle.plate, vehicle.country)}` : null)}
          ${field('País', countryName(vehicle.country))}
          ${field('Color', vehicle.color)}
          ${field('Serial de chasis', vehicle.vin)}
          ${field('Serial de motor', vehicle.engineNumber)}
          ${field('Combustible', fuelLabel(vehicle.fuel))}
          ${field('Aceite', [oilBaseLabel(vehicle.oilBase), [vehicle.oilBrand, vehicle.oilModel].filter(Boolean).join(' '), vehicle.oilType, vehicle.oilLiters ? `${vehicle.oilLiters} L` : null].filter(Boolean).join(' · ') || null)}
          ${field('Refrigerante', [coolantBaseLabel(vehicle.coolantBase), [vehicle.coolantBrand, vehicle.coolantModel].filter(Boolean).join(' '), vehicle.coolantType, vehicle.coolantLiters ? `${vehicle.coolantLiters} L` : null, vehicle.coolantConcentration ? `${vehicle.coolantConcentration}%` : null].filter(Boolean).join(' · ') || null)}
        </div>
      </div>
    </div>
    <div class="stats">
      <div class="stat">Kilometraje<b>${esc(formatKm(snap?.currentKm ?? vehicle.initialOdometer))}</b></div>
      <div class="stat">Registros<b>${records.length}</b></div>
      <div class="stat">Invertido<b>${esc(formatAmount(total))}</b></div>
    </div>
    ${upcoming ? `<h2>Próximos services</h2><ul>${upcoming}</ul>` : ''}
    <h2>Historial</h2>
    <table><thead><tr><th>Fecha</th><th>Detalle</th><th class="right">Km</th><th class="right">Monto</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="muted">Sin registros todavía.</td></tr>'}</tbody></table>
    <div class="foot">Generado con Careful — Tu auto, toda su historia en un solo lugar.</div>
  </body></html>`;
}

export async function shareVehicleReport(vehicleId: string): Promise<void> {
  const html = await buildVehicleReportHtml(vehicleId);
  const { uri } = await Print.printToFileAsync({ html });
  const vehicle = await getVehicle(vehicleId);
  const safe = (vehicle ? vehicleLabel(vehicle) : 'vehiculo').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
  const target = new File(Paths.cache, `Careful-${safe}-historial.pdf`);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  await withExternalActivity(() =>
    Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir historial', UTI: 'com.adobe.pdf' }),
  );
}
