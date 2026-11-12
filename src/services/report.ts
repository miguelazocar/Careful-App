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
import { archiveReasonLabel } from '@/domain/archive';
import { countryName, flagEmoji } from '@/domain/countries';
import { accessoryTag, CORE_ITEM, findCategory, itemName } from '@/domain/maintenance';
import { dueText } from '@/domain/notification-plan';
import { formatPlate } from '@/domain/plate';
import { plateCountryName, plateText, resolvePlateStyle } from '@/domain/plate-styles';
import { summarizeHistory, type SpendGroup } from '@/domain/report-summary';
import { resolveInterval, type UpcomingItem } from '@/domain/schedule';
import { coolantBaseLabel, coolantMix, fuelLabel, oilBaseLabel } from '@/domain/vehicle-specs';
import { formatDay, today } from '@/lib/dates';
import { formatAmount, formatInt, formatKm } from '@/lib/format';
import { withExternalActivity } from '@/stores/ui';

import { attachmentName, isImagePath } from '@/lib/attachments';
import { photoUri } from './photos';
import { loadUpcoming, vehicleLabel } from './upcoming';

/**
 * Vehicle report (PDF) to hand to a buyer or a workshop:
 *  1. Datos del vehículo — photo, technical sheet, usage and the state of the maintenance plan.
 *  2. Historial — every service, repair and accessory with date, km, amount, notes and files.
 *  3. Resumen de servicios y mantenimientos — counts, spending and a breakdown per category.
 *  4. Resumen de accesorios — counts, spending and a breakdown per tag.
 *  5. Total general — everything added up, km driven and cost per km.
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

/** The plate as drawn in the app: Mercosur band, black 1995 Argentine plate, Chile, Perú or EU strip. */
function plateHtml(v: Vehicle): string {
  if (!v.plate) return '';
  const style = resolvePlateStyle(v);
  const text = esc(plateText(style, formatPlate(v.plate, style.country)));
  switch (style.design) {
    case 'mercosur':
      return `<div class="plate"><div class="band"><span>${esc(style.band)}</span><i>${flagEmoji(style.country)}</i></div><b>${text}</b></div>`;
    case 'pe':
      return `<div class="plate pe"><div class="band">${esc(style.band)}</div><b>${text}</b></div>`;
    case 'ar-1995':
      return `<div class="plate old"><div class="inner"><div class="top">${esc(style.band)}</div><b>${text}</b></div></div>`;
    case 'cl':
      return `<div class="plate"><div class="top">${esc(style.band)}</div><b>${text}</b></div>`;
    case 'eu': {
      const stars = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<circle cx="${(7 + 5 * Math.cos(a)).toFixed(2)}" cy="${(7 + 5 * Math.sin(a)).toFixed(2)}" r="0.9" fill="#FFCC00"/>`;
      }).join('');
      return `<div class="plate eu"><div class="strip"><svg width="14" height="14" viewBox="0 0 14 14">${stars}</svg><i>${flagEmoji(style.country)}</i></div><b>${text}</b></div>`;
    }
    default:
      return `<div class="plate"><b>${text}</b></div>`;
  }
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
  return `<div class="keep"><h3 class="sub">Plan de mantenimiento</h3>
    <table class="grid"><thead><tr><th>Servicio</th><th>Último</th><th>Próximo</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function recordCard(r: LogRecordFull, thumbs: string[]): string {
  const docs = r.photos.map((p) => p.path).filter((x) => !isImagePath(x)).map(attachmentName);
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
      ${docs.length ? `<div class="docs">📎 ${docs.map(esc).join(' · ')}</div>` : ''}
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
  for (const r of records.filter((x) => x.kind !== 'odometer')) {
    if (budget <= 0) break;
    const list: string[] = [];
    // documents (PDF, Word…) can't be embedded: they are listed by name in the card
    for (const p of r.photos.filter((x) => isImagePath(x.path)).slice(0, Math.min(THUMBS_PER_RECORD, budget))) {
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

  // the history lists what was done to the car; odometer readings only feed the km figures
  const done = records.filter((r) => r.kind !== 'odometer');
  const history = done.length
    ? done.map((r) => recordCard(r, thumbsBy.get(r.id) ?? [])).join('')
    : '<p class="muted">Todavía no hay servicios ni accesorios registrados.</p>';
  const period = (first: string | null, last: string | null) => (first && last ? (first === last ? formatDay(first) : `${formatDay(first)} – ${formatDay(last)}`) : null);
  const avg = (cents: number, count: number) => (count ? formatAmount(Math.round(cents / count)) : '—');
  const archived = v.archivedAt ? `Archivado · ${archiveReasonLabel(v.archivedReason)} · ${formatDay(v.archivedAt.slice(0, 10))}${v.archivedNote ? ` · ${v.archivedNote}` : ''}` : 'En uso';

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
  .plate { display: inline-flex; flex-direction: column; align-self: flex-start; margin-top: 4px; border: 2px solid #141C2B; border-radius: 6px; overflow: hidden; background: #fff; }
  .plate b { display: block; padding: 2px 12px 3px; font-weight: 800; font-size: 15px; letter-spacing: 2px; text-align: center; color: #111; }
  .plate .band { background: #1F3C8C; color: #fff; font-size: 7px; font-weight: 700; letter-spacing: 1px; text-align: center; padding: 1px 8px; }
  .plate .band { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .plate i { font-style: normal; font-size: 8px; line-height: 1; }
  .plate .top { font-size: 6px; font-weight: 700; letter-spacing: 1px; text-align: center; padding-top: 2px; color: #111; }
  .plate.old { background: #121212; border-color: #000; padding: 1.5px; } .plate.old .inner { border: 1px solid rgba(255,255,255,.8); border-radius: 3px; }
  .plate.old b, .plate.old .top { color: #fff; }
  .plate.pe .band { background: #D91023; }
  .plate.eu { flex-direction: row; } .plate.eu .strip { background: #003399; color: #fff; width: 20px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 2px 0; font-size: 6px; font-weight: 700; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 4px 0 10px; } .kpis.k3 { grid-template-columns: repeat(3, 1fr); }
  .kpi { background: #F2F6FC; border-radius: 10px; padding: 9px 11px; }
  .kpi span { display: block; color: #5F6E85; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; font-weight: 700; }
  .kpi b { display: block; font-size: 16px; color: #0547C9; margin-top: 2px; letter-spacing: -0.3px; }
  h2 { font-size: 12px; margin: 20px 0 8px; color: #0547C9; text-transform: uppercase; letter-spacing: 1.2px; display: flex; align-items: center; gap: 8px; }
  h2 .num { display: inline-flex; width: 20px; height: 20px; border-radius: 10px; background: #0B63F6; color: #fff; align-items: center; justify-content: center; font-size: 11px; letter-spacing: 0; }
  h2, h3.sub { break-after: avoid; page-break-after: avoid; }
  h3.sub { font-size: 10px; margin: 12px 0 6px; color: #3B4A60; text-transform: uppercase; letter-spacing: .8px; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #E1E7F0; border-radius: 12px; overflow: hidden; }
  .sheet h4 { grid-column: 1 / -1; margin: 0; padding: 6px 12px; background: #F7F9FC; font-size: 10px; color: #3B4A60; text-transform: uppercase; letter-spacing: .8px; border-top: 1px solid #E1E7F0; }
  .sheet h4:first-child { border-top: 0; }
  .field { padding: 6px 12px; border-top: 1px solid #EEF1F6; } .field.wide { grid-column: span 2; }
  .field span { display: block; color: #5F6E85; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
  .field b { font-size: 11.5px; } .field b.empty { color: #A3AEC0; font-weight: 400; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #5F6E85; border-bottom: 1px solid #E1E7F0; padding: 5px 6px; }
  table.grid td { border-bottom: 1px solid #EEF1F6; padding: 6px; vertical-align: top; }
  table.grid .n { text-align: right; white-space: nowrap; }
  table.grid tfoot td { font-weight: 800; border-bottom: 0; border-top: 1.5px solid #C9D3E1; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 6px; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 10px; white-space: nowrap; }
  .keep { break-inside: avoid; page-break-inside: avoid; }
  .rec { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #EEF1F6; break-inside: avoid; page-break-inside: avoid; }
  .when { width: 58px; text-align: center; flex-shrink: 0; } .when b { display: block; font-size: 22px; color: #0547C9; line-height: 1; } .when span { color: #5F6E85; font-size: 9.5px; text-transform: uppercase; }
  .body { flex: 1; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .kind { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; border: 1px solid; border-radius: 8px; padding: 1px 7px; }
  .amount { font-weight: 800; font-size: 12.5px; }
  .rec h3 { margin: 4px 0 2px; font-size: 13px; }
  .meta { display: flex; gap: 14px; color: #3B4A60; font-size: 10.5px; }
  .body p { margin: 5px 0 0; color: #2A3446; }
  .next { margin-top: 5px; padding: 5px 8px; background: #F2F6FC; border-radius: 6px; color: #0547C9; font-size: 10px; }
  .docs { margin-top: 6px; font-size: 11px; color: #475569; }
  .thumbs { display: flex; gap: 6px; margin-top: 7px; } .thumbs img { width: 120px; height: 86px; object-fit: cover; border-radius: 8px; }
  table.totals { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.totals td { padding: 9px 12px; border-bottom: 1px solid #E1E7F0; font-size: 12px; }
  table.totals td:last-child { text-align: right; font-weight: 700; white-space: nowrap; }
  table.totals tr.grand td { background: #0B63F6; color: #fff; font-size: 15px; font-weight: 800; border-bottom: 0; }
  table.totals tr.grand td small { color: rgba(255,255,255,.8); }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #E1E7F0; color: #94A0B4; font-size: 9px; text-align: center; }
</style></head><body>

<div class="hdr"><div class="logo"><span class="c">Car</span><span class="t">eful</span></div>
  <div class="doc"><b>Reporte del vehículo</b>Generado el ${esc(formatDay(now, "d 'de' MMMM 'de' yyyy"))}</div></div>

<div class="hero">
  ${cover ? `<div class="photo" style="background-image:url('${cover}')"></div>` : ''}
  <div class="id">
    <div class="brand">${brandBadge(v, 34)}${esc(v.brand)}${v.year ? ` · ${v.year}` : ''}</div>
    <h1>${esc(vehicleLabel(v))}</h1>
    ${v.variant ? `<div class="ver">${esc(v.variant)}</div>` : ''}
    ${plateHtml(v)}
  </div>
</div>

<section><h2><span class="num">1</span>Datos del vehículo</h2>
<div class="sheet keep">
  <h4>Vehículo</h4>
  ${field('Marca', v.brand)}${field('Modelo', v.model)}${field('Año', v.year)}
  ${field('Versión', v.variant, true)}${field('Color', v.color)}
  ${field('Patente', plate)}${field('País', plateCountryName(v.country) ?? (v.country === 'XX' ? null : countryName(v.country)))}${field('Combustible', fuelLabel(v.fuel))}
  ${field('N° de chasis (VIN)', v.vin, true)}${field('N° de motor', v.engineNumber)}
  <h4>Uso</h4>
  ${field('Kilometraje actual', formatKm(s.kmNow))}${field('Km recorridos desde el alta', formatKm(s.kmDriven))}${field('Uso promedio', s.kmPerMonth ? `${formatInt(s.kmPerMonth)} km/mes` : null)}
  ${field('En Careful desde', formatDay(s.since))}${field('Estado', archived, true)}
  <h4>Aceite de motor</h4>
  ${field('Tipo', oilBaseLabel(v.oilBase))}${field('Marca y modelo', [v.oilBrand, v.oilModel].filter(Boolean).join(' ') || null)}${field('Versión', v.oilType)}
  ${field('Cantidad (con filtro)', liters(v.oilLiters))}${field('Cambio cada', oilEvery || null, true)}
  <h4>Refrigerante</h4>
  ${field('Tipo', coolantBaseLabel(v.coolantBase))}${field('Marca y modelo', [v.coolantBrand, v.coolantModel].filter(Boolean).join(' ') || null)}${field('Versión', v.coolantType)}
  ${field('Cantidad total', liters(v.coolantLiters))}${field('Concentración', v.coolantConcentration ? `${v.coolantConcentration}%` : null)}
  ${field('Mezcla', mix ? `${liters(mix.coolant)} refrigerante + ${liters(mix.water)} agua desmineralizada` : null)}
</div>
${v.archivedAt ? '' : serviceTable(upcoming.items)}
</section>

<section><h2><span class="num">2</span>Historial · ${done.length} ${done.length === 1 ? 'registro' : 'registros'}</h2>${history}</section>

<section class="keep"><h2><span class="num">3</span>Resumen de servicios y mantenimientos</h2>
${
  s.services
    ? `<div class="kpis">
  ${kpi('Servicios realizados', formatInt(s.services), period(s.firstService, s.lastService))}
  ${kpi('Gastado en servicios', formatAmount(s.serviceCents), `promedio ${avg(s.serviceCents, s.services)} por servicio`)}
  ${kpi('Cambios de aceite', formatInt(s.oilChanges), s.lastOilChange ? `último: ${formatDay(s.lastOilChange.date)}${s.lastOilChange.km !== null ? ` · ${formatKm(s.lastOilChange.km)}` : ''}` : null)}
  ${kpi('Último servicio', s.lastService ? formatDay(s.lastService) : '—', null)}
</div>
${breakdown(s.serviceGroups, s.serviceCents, 'Rubro', 'Servicios')}`
    : '<p class="muted">No hay servicios ni mantenimientos registrados.</p>'
}
</section>

<section class="keep"><h2><span class="num">4</span>Resumen de accesorios</h2>
${
  s.accessories
    ? `<div class="kpis k3">
  ${kpi('Accesorios instalados', formatInt(s.accessories), period(s.firstAccessory, s.lastAccessory))}
  ${kpi('Gastado en accesorios', formatAmount(s.accessoryCents), `promedio ${avg(s.accessoryCents, s.accessories)} por accesorio`)}
  ${kpi('Último accesorio', s.lastAccessory ? formatDay(s.lastAccessory) : '—', null)}
</div>
${breakdown(s.accessoryTags, s.accessoryCents, 'Etiqueta', 'Cantidad')}`
    : '<p class="muted">No hay accesorios registrados.</p>'
}
</section>

<section class="keep"><h2><span class="num">5</span>Total general</h2>
<table class="totals">
  <tr><td>Servicios y mantenimientos<small>${s.services} ${s.services === 1 ? 'registro' : 'registros'}</small></td><td>${esc(formatAmount(s.serviceCents))}</td></tr>
  <tr><td>Accesorios<small>${s.accessories} ${s.accessories === 1 ? 'registro' : 'registros'}</small></td><td>${esc(formatAmount(s.accessoryCents))}</td></tr>
  <tr class="grand"><td>Total gastado<small>${s.services + s.accessories} registros · ${esc(period(s.since, now) ?? '')}</small></td><td>${esc(formatAmount(s.totalCents))}</td></tr>
</table>
<div class="kpis k3">
  ${kpi('Km recorridos desde el alta', formatKm(s.kmDriven), `${formatInt(s.kmStart)} → ${formatInt(s.kmNow)} km`)}
  ${kpi('Costo por km', s.costPerKmCents !== null ? formatAmount(s.costPerKmCents) : '—', 'total gastado ÷ km recorridos')}
  ${kpi('Período del historial', s.months >= 1 ? months(s.months) : 'menos de 1 mes', `desde ${formatDay(s.since)}`)}
</div>
</section>

<div class="foot">Reporte generado con Careful el ${esc(formatDay(now))}. Los registros fueron cargados por el propietario del vehículo.</div>
</body></html>`;
}

/** Summary table of a breakdown (rubros or etiquetas) with a total row. */
function breakdown(groups: SpendGroup[], totalCents: number, firstCol: string, countCol: string): string {
  if (!groups.length) return '';
  const count = groups.reduce((n, g) => n + g.count, 0);
  const rows = groups
    .map((g) => {
      const share = totalCents ? Math.round((g.cents / totalCents) * 100) : 0;
      return `<tr><td><i class="dot" style="background:${g.color}"></i>${esc(g.label)}</td><td class="n">${g.count}</td><td class="n">${esc(formatAmount(g.cents))}</td><td class="n">${share}%</td></tr>`;
    })
    .join('');
  return `<table class="grid"><thead><tr><th>${esc(firstCol)}</th><th class="n">${esc(countCol)}</th><th class="n">Gastado</th><th class="n">% del gasto</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td>Total</td><td class="n">${count}</td><td class="n">${esc(formatAmount(totalCents))}</td><td class="n">${totalCents ? '100%' : '—'}</td></tr></tfoot></table>`;
}

export async function shareVehicleReport(vehicleId: string): Promise<void> {
  const html = await buildVehicleReportHtml(vehicleId);
  const { uri } = await Print.printToFileAsync({ html });
  const vehicle = await getVehicle(vehicleId);
  const safe = (vehicle ? vehicleLabel(vehicle) : 'vehiculo').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
  const target = new File(Paths.cache, `Careful-${safe}-reporte.pdf`);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  await withExternalActivity(() =>
    Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir reporte del vehículo', UTI: 'com.adobe.pdf' }),
  );
}
