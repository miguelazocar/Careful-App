import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { BRAND_LOGOS } from '@/data/catalog/logos';
import { listRecords } from '@/db/records';
import { getServiceRules } from '@/db/reminders';
import type { LogRecordFull, Vehicle } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import { isLightColor } from '@/domain/colors';
import { countryName, flagEmoji } from '@/domain/countries';
import { accessoryTag, CORE_ITEM, findCategory, itemName } from '@/domain/maintenance';
import { dueText } from '@/domain/notification-plan';
import { formatPlate } from '@/domain/plate';
import { summarizeHistory, type ReportSummary } from '@/domain/report-summary';
import { resolveInterval, type UpcomingItem } from '@/domain/schedule';
import { coolantBaseLabel, coolantMix, fuelLabel, oilBaseLabel } from '@/domain/vehicle-specs';
import { formatDay, today } from '@/lib/dates';
import { formatAmount, formatInt, formatKm } from '@/lib/format';
import { withExternalActivity } from '@/stores/ui';

import { photoUri } from './photos';
import { loadUpcoming, vehicleLabel } from './upcoming';

/**
 * Vehicle report (PDF) to hand to a buyer or a workshop:
 *  1. Resumen — photo, technical sheet, key figures since the vehicle was added, spending by
 *     category and the state of every scheduled service.
 *  2. Historial — every record with date, km, amount, what was done, notes and photos.
 */

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Photos are shrunk before embedding so the PDF stays light. */
const MAX_THUMBS = 48;
const THUMBS_PER_RECORD = 3;

const KIND: Record<string, { label: string; color: string }> = {
  maintenance: { label: 'Servicio', color: '#0B63F6' },
  accessory: { label: 'Accesorio', color: '#0FA57D' },
  odometer: { label: 'Kilometraje', color: '#475569' },
};

const STATUS: Record<string, { label: string; mark: string; color: string; bg: string }> = {
  ok: { label: 'Al día', mark: '✓', color: '#0E7A55', bg: '#E3F6EE' },
  soon: { label: 'Pronto', mark: '!', color: '#9A5B00', bg: '#FFF1D6' },
  overdue: { label: 'Vencido', mark: '✕', color: '#B42332', bg: '#FDE7EA' },
};

const liters = (n: number | null | undefined) => (n ? `${String(Math.round(n * 100) / 100).replace('.', ',')} L` : null);
const months = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`;

async function imageData(path: string | null | undefined, width: number, quality: number): Promise<string | null> {
  const uri = photoUri(path);
  if (!uri) return null;
  try {
    if (!new File(uri).exists) return null;
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width });
    const img = await ctx.renderAsync();
    const saved = await img.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
    const b64 = saved.base64 ?? (await new File(saved.uri).base64());
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

function brandBadge(v: Vehicle, size: number): string {
  const logo = v.brandId ? BRAND_LOGOS[v.brandId] : undefined;
  const bg = logo?.hex ?? '#3A4658';
  const fg = isLightColor(bg) ? '#1D2633' : '#FFFFFF';
  const inner = logo
    ? `<svg width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 24 24"><path d="${logo.path}" fill="${fg}"/></svg>`
    : `<span style="color:${fg};font-weight:800;font-size:${size * 0.36}px">${esc((v.brand || '?').slice(0, 2).toUpperCase())}</span>`;
  return `<div class="badge" style="width:${size}px;height:${size}px;border-radius:${size * 0.28}px;background:${bg}">${inner}</div>`;
}

function field(label: string, value: string | number | null | undefined, wide = false): string {
  const empty = value === null || value === undefined || value === '';
  return `<div class="field${wide ? ' wide' : ''}"><span>${esc(label)}</span><b${empty ? ' class="empty"' : ''}>${empty ? '—' : esc(String(value))}</b></div>`;
}

function kpi(label: string, value: string, sub?: string | null): string {
  return `<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}

function spendBars(s: ReportSummary): string {
  if (!s.byGroup.length) return '';
  const max = Math.max(...s.byGroup.map((g) => g.cents));
  const rows = s.byGroup
    .slice(0, 8)
    .map((g) => {
      const pct = Math.max(2, Math.round((g.cents / max) * 100));
      const share = s.totalCents ? Math.round((g.cents / s.totalCents) * 100) : 0;
      return `<div class="bar"><div class="bl"><i style="background:${g.color}"></i>${esc(g.label)}<small>${g.count} ${g.count === 1 ? 'registro' : 'registros'}</small></div>
        <div class="bt"><div style="width:${pct}%"></div></div><div class="bv">${esc(formatAmount(g.cents))}<small>${share}%</small></div></div>`;
    })
    .join('');
  return `<section class="keep"><h2>Gastos por rubro</h2><div class="bars">${rows}</div></section>`;
}

function serviceTable(items: UpcomingItem[]): string {
  const services = items.filter((i) => i.source === 'service' || i.source === 'manual');
  if (!services.length) return '';
  const rows = services
    .map((i) => {
      const st = STATUS[i.due.status];
      const last = i.lastDate ? `${formatDay(i.lastDate)}${i.lastKm !== null && i.lastKm !== undefined ? `<small>${esc(formatKm(i.lastKm))}</small>` : ''}` : '<span class="muted">Sin registro</span>';
      const every = [i.intervalKm ? formatKm(i.intervalKm) : null, i.intervalMonths ? months(i.intervalMonths) : null].filter(Boolean).join(' o ');
      return `<tr><td><b>${esc(i.title)}</b>${every ? `<small>Cada ${esc(every)}</small>` : ''}</td><td>${last}</td>
        <td>${esc(dueText(i.due)) || '—'}${i.estimated ? '<small>Estimado</small>' : ''}</td>
        <td><span class="chip" style="color:${st.color};background:${st.bg}">${st.mark} ${st.label}</span></td></tr>`;
    })
    .join('');
  return `<section class="keep"><h2>Estado del mantenimiento</h2>
    <table class="grid"><thead><tr><th>Servicio</th><th>Último</th><th>Próximo</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function recordCard(r: LogRecordFull, thumbs: string[]): string {
  const kind = KIND[r.kind] ?? KIND.maintenance;
  const d = r.date.split('-');
  const title = r.kind === 'odometer' ? 'Actualización de kilometraje' : r.items.map(itemName).join(' · ') || kind.label;
  const first = r.items[0];
  // maintenance shows its category; an accessory, its tag
  const sub = !first ? null : r.kind === 'accessory' ? (accessoryTag(first.item)?.label ?? null) : r.kind === 'maintenance' ? (findCategory(first.category)?.label ?? null) : null;
  const intervals = r.items
    .filter((i) => i.intervalKm || i.intervalMonths)
    .map((i) => `${itemName(i)}: próximo cada ${[i.intervalKm ? formatKm(i.intervalKm) : null, i.intervalMonths ? months(i.intervalMonths) : null].filter(Boolean).join(' o ')}`);
  return `<article class="rec">
    <div class="when"><b>${d[2]}</b><span>${esc(formatDay(r.date, 'MMM yyyy'))}</span></div>
    <div class="body">
      <div class="top"><span class="kind" style="color:${kind.color};border-color:${kind.color}">${kind.label}${sub ? ` · ${esc(sub)}` : ''}</span>
        <span class="amount">${r.amountCents !== null ? esc(formatAmount(r.amountCents)) : ''}</span></div>
      <h3>${esc(title)}</h3>
      <div class="meta">${r.odometer !== null ? `<span>⏱ ${esc(formatKm(r.odometer))}</span>` : ''}${r.workshop ? `<span>🔧 ${esc(r.workshop)}</span>` : ''}</div>
      ${r.description ? `<p>${esc(r.description).replace(/\n/g, '<br/>')}</p>` : ''}
      ${intervals.length ? `<div class="next">${intervals.map(esc).join('<br/>')}</div>` : ''}
      ${thumbs.length ? `<div class="thumbs">${thumbs.map((t) => `<img src="${t}"/>`).join('')}</div>` : ''}
    </div>
  </article>`;
}

export async function buildVehicleReportHtml(vehicleId: string): Promise<string> {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) throw new Error('Vehículo no encontrado');
  const [records, upcoming, rules] = await Promise.all([listRecords({ vehicleId }), loadUpcoming({ vehicleId }), getServiceRules(vehicleId)]);
  const snap = upcoming.snapshots.get(vehicleId);
  const now = today();
  const s = summarizeHistory(vehicle, records, { km: snap?.currentKm ?? vehicle.initialOdometer, dailyKm: snap?.dailyKm ?? null }, now);
  const v = vehicle;

  const cover = await imageData(v.photo, 1000, 0.75);
  let budget = MAX_THUMBS;
  const thumbsBy = new Map<string, string[]>();
  for (const r of records) {
    if (budget <= 0) break;
    const list: string[] = [];
    for (const p of r.photos.slice(0, Math.min(THUMBS_PER_RECORD, budget))) {
      const t = await imageData(p.path, 420, 0.6);
      if (t) list.push(t);
    }
    budget -= list.length;
    if (list.length) thumbsBy.set(r.id, list);
  }

  const oilPlan = resolveInterval(CORE_ITEM, rules);
  const oilEvery = [oilPlan.intervalKm ? formatKm(oilPlan.intervalKm) : null, oilPlan.intervalMonths ? months(oilPlan.intervalMonths) : null].filter(Boolean).join(' o ');
  const mix = coolantMix(v.coolantLiters, v.coolantConcentration);
  const plate = v.plate ? formatPlate(v.plate, v.country) : null;

  const history = records.length
    ? records.map((r) => recordCard(r, thumbsBy.get(r.id) ?? [])).join('')
    : '<p class="muted">Todavía no hay registros.</p>';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 14mm 13mm; }
  * { box-sizing: border-box; }
  body { font-family: Roboto, -apple-system, 'Segoe UI', sans-serif; color: #141C2B; margin: 0; font-size: 11px; line-height: 1.4; }
  small { display: block; color: #5F6E85; font-size: 9.5px; font-weight: 400; }
  .muted { color: #5F6E85; }
  .hdr { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2.5px solid #0B63F6; }
  .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; } .logo .c { color: #0B63F6; font-style: italic; } .logo .t { color: #1D2633; }
  .hdr .doc { text-align: right; color: #5F6E85; font-size: 10px; } .hdr .doc b { display: block; color: #141C2B; font-size: 12px; }
  .hero { display: flex; gap: 16px; margin-top: 14px; align-items: stretch; }
  .photo { width: 46%; min-height: 150px; border-radius: 14px; background: #EEF2F8 center / cover no-repeat; }
  .id { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
  .badge { display: inline-flex; align-items: center; justify-content: center; }
  .id .brand { display: flex; align-items: center; gap: 10px; color: #5F6E85; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  h1 { font-size: 26px; line-height: 1.1; margin: 0; letter-spacing: -0.5px; }
  .ver { color: #3B4A60; font-size: 12px; }
  .plate { display: inline-block; align-self: flex-start; margin-top: 4px; padding: 3px 12px; border: 2px solid #141C2B; border-radius: 6px; font-weight: 800; font-size: 15px; letter-spacing: 2px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
  .kpi { background: #F2F6FC; border-radius: 10px; padding: 9px 11px; }
  .kpi span { display: block; color: #5F6E85; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; font-weight: 700; }
  .kpi b { display: block; font-size: 17px; color: #0547C9; margin-top: 2px; letter-spacing: -0.3px; }
  h2 { font-size: 11px; margin: 18px 0 8px; color: #0547C9; text-transform: uppercase; letter-spacing: 1.2px; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #E1E7F0; border-radius: 12px; overflow: hidden; }
  .sheet h4 { grid-column: 1 / -1; margin: 0; padding: 6px 12px; background: #F7F9FC; font-size: 10px; color: #3B4A60; text-transform: uppercase; letter-spacing: .8px; border-top: 1px solid #E1E7F0; }
  .sheet h4:first-child { border-top: 0; }
  .field { padding: 6px 12px; border-top: 1px solid #EEF1F6; } .field.wide { grid-column: span 2; }
  .field span { display: block; color: #5F6E85; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
  .field b { font-size: 11.5px; } .field b.empty { color: #A3AEC0; font-weight: 400; }
  .bars { display: grid; gap: 6px; }
  .bar { display: grid; grid-template-columns: 34% 1fr 22%; gap: 10px; align-items: center; }
  .bl { font-weight: 600; } .bl i { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 6px; }
  .bl small { display: inline; margin-left: 6px; }
  .bt { height: 10px; background: #EEF2F8; border-radius: 5px; overflow: hidden; } .bt div { height: 10px; background: #0B63F6; border-radius: 5px; }
  .bv { text-align: right; font-weight: 700; } .bv small { display: inline; margin-left: 6px; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #5F6E85; border-bottom: 1px solid #E1E7F0; padding: 5px 6px; }
  table.grid td { border-bottom: 1px solid #EEF1F6; padding: 6px; vertical-align: top; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 10px; white-space: nowrap; }
  .keep { break-inside: avoid; page-break-inside: avoid; }
  .rec { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #EEF1F6; break-inside: avoid; page-break-inside: avoid; }
  .when { width: 58px; text-align: center; flex-shrink: 0; } .when b { display: block; font-size: 22px; color: #0547C9; line-height: 1; } .when span { color: #5F6E85; font-size: 9.5px; text-transform: uppercase; }
  .body { flex: 1; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .kind { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; border: 1px solid; border-radius: 8px; padding: 1px 7px; }
  .amount { font-weight: 800; font-size: 12.5px; }
  h3 { margin: 4px 0 2px; font-size: 13px; }
  .meta { display: flex; gap: 14px; color: #3B4A60; font-size: 10.5px; }
  .body p { margin: 5px 0 0; color: #2A3446; }
  .next { margin-top: 5px; padding: 5px 8px; background: #F2F6FC; border-radius: 6px; color: #0547C9; font-size: 10px; }
  .thumbs { display: flex; gap: 6px; margin-top: 7px; } .thumbs img { width: 120px; height: 86px; object-fit: cover; border-radius: 8px; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #E1E7F0; color: #94A0B4; font-size: 9px; text-align: center; }
</style></head><body>

<div class="hdr"><div class="logo"><span class="c">Car</span><span class="t">eful</span></div>
  <div class="doc"><b>Informe del vehículo</b>Generado el ${esc(formatDay(now, "d 'de' MMMM 'de' yyyy"))}</div></div>

<div class="hero">
  ${cover ? `<div class="photo" style="background-image:url('${cover}')"></div>` : ''}
  <div class="id">
    <div class="brand">${brandBadge(v, 34)}${esc(v.brand)}${v.year ? ` · ${v.year}` : ''}</div>
    <h1>${esc(vehicleLabel(v))}</h1>
    ${v.variant ? `<div class="ver">${esc(v.variant)}</div>` : ''}
    ${plate ? `<div class="plate">${esc(plate)}</div>` : ''}
  </div>
</div>

<div class="kpis">
  ${kpi('Km recorridos', formatKm(s.kmDriven), `desde el alta: ${formatInt(s.kmStart)} → ${formatInt(s.kmNow)} km`)}
  ${kpi('Kilometraje actual', formatKm(s.kmNow), s.kmPerMonth ? `uso promedio ${formatInt(s.kmPerMonth)} km/mes` : null)}
  ${kpi('Gasto total', formatAmount(s.totalCents), `servicios ${formatAmount(s.serviceCents)} · accesorios ${formatAmount(s.accessoryCents)}`)}
  ${kpi('Costo por km', s.costPerKmCents !== null ? formatAmount(s.costPerKmCents) : '—', 'gasto total ÷ km recorridos')}
  ${kpi('Servicios realizados', formatInt(s.services), s.lastService ? `último: ${formatDay(s.lastService)}` : null)}
  ${kpi('Cambios de aceite', formatInt(s.oilChanges), s.lastOilChange ? `último: ${formatDay(s.lastOilChange.date)}${s.lastOilChange.km !== null ? ` · ${formatKm(s.lastOilChange.km)}` : ''}` : null)}
  ${kpi('Accesorios', formatInt(s.accessories), s.accessories ? formatAmount(s.accessoryCents) : null)}
  ${kpi('Historial', s.months >= 1 ? months(s.months) : 'menos de 1 mes', `desde ${formatDay(s.since)} · ${s.records} registros`)}
</div>

<section class="keep"><h2>Ficha técnica</h2>
<div class="sheet">
  <h4>Vehículo</h4>
  ${field('Marca', v.brand)}${field('Modelo', v.model)}${field('Año', v.year)}
  ${field('Versión', v.variant, true)}${field('Color', v.color)}
  ${field('Patente', plate ? `${flagEmoji(v.country)} ${plate}` : null)}${field('País', countryName(v.country))}${field('Combustible', fuelLabel(v.fuel))}
  ${field('N° de chasis (VIN)', v.vin, true)}${field('N° de motor', v.engineNumber)}
  <h4>Aceite de motor</h4>
  ${field('Tipo', oilBaseLabel(v.oilBase))}${field('Marca y modelo', [v.oilBrand, v.oilModel].filter(Boolean).join(' ') || null)}${field('Versión', v.oilType)}
  ${field('Cantidad (con filtro)', liters(v.oilLiters))}${field('Cambio cada', oilEvery || null, true)}
  <h4>Refrigerante</h4>
  ${field('Tipo', coolantBaseLabel(v.coolantBase))}${field('Marca y modelo', [v.coolantBrand, v.coolantModel].filter(Boolean).join(' ') || null)}${field('Versión', v.coolantType)}
  ${field('Cantidad total', liters(v.coolantLiters))}${field('Concentración', v.coolantConcentration ? `${v.coolantConcentration}%` : null)}
  ${field('Mezcla', mix ? `${liters(mix.coolant)} refrigerante + ${liters(mix.water)} agua desmineralizada` : null)}
</div></section>

${spendBars(s)}
${serviceTable(upcoming.items)}

<section><h2>Historial detallado · ${s.records} registros</h2>${history}</section>

<div class="foot">Informe generado con Careful el ${esc(formatDay(now))}. Los registros fueron cargados por el propietario del vehículo.</div>
</body></html>`;
}

export async function shareVehicleReport(vehicleId: string): Promise<void> {
  const html = await buildVehicleReportHtml(vehicleId);
  const { uri } = await Print.printToFileAsync({ html });
  const vehicle = await getVehicle(vehicleId);
  const safe = (vehicle ? vehicleLabel(vehicle) : 'vehiculo').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
  const target = new File(Paths.cache, `Careful-${safe}-informe.pdf`);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  await withExternalActivity(() =>
    Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir informe del vehículo', UTI: 'com.adobe.pdf' }),
  );
}
