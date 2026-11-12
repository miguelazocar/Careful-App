/**
 * Maintenance & accessory taxonomy.
 *
 * Item keys are stable identifiers persisted in the database (`record_items.item`).
 * Never rename a key; add new ones instead. Labels can change freely.
 *
 * `intervalKm` / `intervalMonths` are generic, conservative defaults used to schedule the
 * next service ("lo que ocurra primero"). Users can override them per vehicle. Only the
 * PLAN_ITEMS carry them: nothing else is scheduled.
 */

export type IconName = string;

export interface CatalogItem {
  key: string;
  label: string;
  intervalKm?: number;
  intervalMonths?: number;
}

export interface Category {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  items: CatalogItem[];
}

export const OTHER_ITEM_SUFFIX = 'otro';

export const MAINTENANCE_CATEGORIES: Category[] = [
  {
    key: 'motor',
    label: 'Motor',
    icon: 'engine',
    color: '#0B63F6',
    items: [
      { key: 'motor.aceite', label: 'Cambio de aceite y filtro', intervalKm: 10000, intervalMonths: 12 },
      { key: 'motor.aceite_relleno', label: 'Relleno de aceite' },
      { key: 'motor.filtro_aceite', label: 'Filtro de aceite' },
      { key: 'motor.filtro_aire', label: 'Filtro de aire del motor', intervalKm: 20000, intervalMonths: 24 },
      { key: 'motor.filtro_combustible', label: 'Filtro de combustible', intervalKm: 30000, intervalMonths: 24 },
      { key: 'motor.bujias', label: 'Bujías', intervalKm: 40000, intervalMonths: 36 },
      { key: 'motor.distribucion', label: 'Kit de distribución', intervalKm: 60000, intervalMonths: 48 },
      { key: 'motor.correa_accesorios', label: 'Correa de accesorios' },
      { key: 'motor.refrigerante', label: 'Cambio de refrigerante' },
      { key: 'motor.refrigerante_relleno', label: 'Relleno de refrigerante' },
      { key: 'motor.termostato', label: 'Termostato' },
      { key: 'motor.bomba_agua', label: 'Bomba de agua' },
      { key: 'motor.radiador', label: 'Radiador / mangueras' },
      { key: 'motor.inyectores', label: 'Limpieza de inyectores' },
      { key: 'motor.escape', label: 'Escape / silenciador' },
      { key: 'motor.diagnostico', label: 'Escaneo / diagnóstico' },
      { key: 'motor.otro', label: 'Otro' },
    ],
  },
  {
    key: 'caja',
    label: 'Caja',
    icon: 'car-shift-pattern',
    color: '#7C5CFF',
    items: [
      { key: 'caja.aceite', label: 'Aceite de caja' },
      { key: 'caja.atf', label: 'Fluido caja automática / CVT' },
      { key: 'caja.embrague', label: 'Kit de embrague' },
      { key: 'caja.homocineticas', label: 'Homocinéticas / fuelles' },
      { key: 'caja.diferencial', label: 'Aceite de diferencial' },
      { key: 'caja.cardan', label: 'Cardán / crucetas' },
      { key: 'caja.otro', label: 'Otro' },
    ],
  },
  {
    key: 'frenos',
    label: 'Frenos',
    icon: 'car-brake-abs',
    color: '#E8384F',
    items: [
      { key: 'frenos.pastillas_del', label: 'Pastillas delanteras' },
      { key: 'frenos.traseros', label: 'Pastillas / cintas traseras' },
      { key: 'frenos.discos', label: 'Discos' },
      { key: 'frenos.campanas', label: 'Campanas' },
      { key: 'frenos.liquido', label: 'Líquido de frenos' },
      { key: 'frenos.revision', label: 'Revisión de frenos' },
      { key: 'frenos.mano', label: 'Freno de mano' },
      { key: 'frenos.otro', label: 'Otro' },
    ],
  },
  {
    key: 'tren_delantero',
    label: 'Tren delantero',
    icon: 'car-cog',
    color: '#0EA5E9',
    items: [
      { key: 'tren_delantero.revision', label: 'Revisión de tren delantero' },
      { key: 'tren_delantero.amortiguadores', label: 'Amortiguadores delanteros' },
      { key: 'tren_delantero.rotulas', label: 'Rótulas' },
      { key: 'tren_delantero.extremos', label: 'Extremos de dirección' },
      { key: 'tren_delantero.bujes', label: 'Bujes / parrillas' },
      { key: 'tren_delantero.bieletas', label: 'Bieletas' },
      { key: 'tren_delantero.cremallera', label: 'Cremallera / dirección' },
      { key: 'tren_delantero.rodamientos', label: 'Rodamientos' },
      { key: 'tren_delantero.otro', label: 'Otro' },
    ],
  },
  {
    key: 'tren_trasero',
    label: 'Tren trasero',
    icon: 'car-traction-control',
    color: '#06B6D4',
    items: [
      { key: 'tren_trasero.amortiguadores', label: 'Amortiguadores traseros' },
      { key: 'tren_trasero.bujes', label: 'Bujes / puente' },
      { key: 'tren_trasero.espirales', label: 'Espirales / elásticos' },
      { key: 'tren_trasero.rodamientos', label: 'Rodamientos' },
      { key: 'tren_trasero.otro', label: 'Otro' },
    ],
  },
  {
    key: 'ruedas',
    label: 'Ruedas',
    icon: 'tire',
    color: '#334155',
    items: [
      { key: 'ruedas.alineacion_balanceo', label: 'Alineación y balanceo' },
      { key: 'ruedas.rotacion', label: 'Rotación de neumáticos' },
      { key: 'ruedas.neumaticos', label: 'Neumáticos nuevos' },
      { key: 'ruedas.gomeria', label: 'Reparación (gomería)' },
      { key: 'ruedas.auxilio', label: 'Rueda de auxilio' },
      { key: 'ruedas.otro', label: 'Otro' },
    ],
  },
  {
    key: 'electrico',
    label: 'Sistema eléctrico',
    icon: 'car-battery',
    color: '#E8930C',
    items: [
      { key: 'electrico.bateria', label: 'Cambio de batería' },
      { key: 'electrico.bateria_carga', label: 'Carga / prueba de batería' },
      { key: 'electrico.bateria_bornes', label: 'Limpieza de bornes' },
      { key: 'electrico.alternador', label: 'Alternador' },
      { key: 'electrico.arranque', label: 'Burro de arranque' },
      { key: 'electrico.lamparas', label: 'Lámparas / ópticas' },
      { key: 'electrico.fusibles', label: 'Fusibles / cableado' },
      { key: 'electrico.escobillas', label: 'Escobillas limpiaparabrisas' },
      { key: 'electrico.sensores', label: 'Sensores / ECU' },
      { key: 'electrico.otro', label: 'Otro' },
    ],
  },
  {
    key: 'climatizacion',
    label: 'Climatización',
    icon: 'air-conditioner',
    color: '#14C895',
    items: [
      { key: 'climatizacion.filtro_habitaculo', label: 'Filtro de aire del habitáculo', intervalKm: 15000, intervalMonths: 12 },
      { key: 'climatizacion.gas', label: 'Carga de gas A/C' },
      { key: 'climatizacion.compresor', label: 'Compresor' },
      { key: 'climatizacion.calefaccion', label: 'Calefacción' },
      { key: 'climatizacion.otro', label: 'Otro' },
    ],
  },
  {
    key: 'carroceria',
    label: 'Carrocería',
    icon: 'car-door',
    color: '#8B5CF6',
    items: [
      { key: 'carroceria.chapa_pintura', label: 'Chapa y pintura' },
      { key: 'carroceria.pulido', label: 'Pulido' },
      { key: 'carroceria.cristales', label: 'Parabrisas / cristales' },
      { key: 'carroceria.cerraduras', label: 'Cerraduras / levantavidrios' },
      { key: 'carroceria.espejos', label: 'Espejos' },
      { key: 'carroceria.otro', label: 'Otro' },
    ],
  },
  {
    key: 'tapiceria',
    label: 'Tapicería',
    icon: 'car-seat',
    color: '#A16207',
    items: [
      { key: 'tapiceria.butacas', label: 'Butacas' },
      { key: 'tapiceria.techo', label: 'Techo / paneles' },
      { key: 'tapiceria.volante', label: 'Volante' },
      { key: 'tapiceria.limpieza', label: 'Limpieza de tapizados' },
      { key: 'tapiceria.otro', label: 'Otro' },
    ],
  },
  {
    key: 'lavado',
    label: 'Lavado',
    icon: 'car-wash',
    color: '#38BDF8',
    items: [
      { key: 'lavado.exterior', label: 'Lavado exterior' },
      { key: 'lavado.completo', label: 'Lavado completo' },
      { key: 'lavado.encerado', label: 'Encerado' },
      { key: 'lavado.detailing', label: 'Detailing' },
      { key: 'lavado.motor', label: 'Lavado de motor' },
      { key: 'lavado.ceramico', label: 'Tratamiento cerámico' },
      { key: 'lavado.otro', label: 'Otro' },
    ],
  },
  {
    key: 'tramites',
    label: 'Inspección',
    icon: 'clipboard-check-outline',
    color: '#13A974',
    items: [
      { key: 'tramites.vtv', label: 'VTV / inspección técnica' },
      { key: 'tramites.service_oficial', label: 'Service oficial' },
      { key: 'tramites.revision_general', label: 'Revisión general' },
      { key: 'tramites.otro', label: 'Otro' },
    ],
  },
];

export const ACCESSORY_CATEGORY: Category = {
  key: 'accesorios',
  label: 'Accesorios',
  icon: 'star-four-points',
  color: '#2EE8B6',
  items: [
    { key: 'accesorios.luces', label: 'Luces' },
    { key: 'accesorios.alfombras', label: 'Alfombras' },
    { key: 'accesorios.parlantes', label: 'Parlantes' },
    { key: 'accesorios.estereo', label: 'Estéreo' },
    { key: 'accesorios.polarizado', label: 'Polarizado' },
    { key: 'accesorios.llantas', label: 'Llantas' },
    { key: 'accesorios.matafuego', label: 'Matafuego' },
    { key: 'accesorios.fundas', label: 'Fundas' },
    { key: 'accesorios.alarma', label: 'Alarma' },
    { key: 'accesorios.gps', label: 'GPS / rastreador' },
    { key: 'accesorios.camara', label: 'Cámara de retroceso' },
    { key: 'accesorios.sensores', label: 'Sensores de estacionamiento' },
    { key: 'accesorios.dashcam', label: 'Dashcam' },
    { key: 'accesorios.portaequipaje', label: 'Portaequipaje / barras' },
    { key: 'accesorios.enganche', label: 'Enganche' },
    { key: 'accesorios.cubrevolante', label: 'Cubrevolante' },
    { key: 'accesorios.kit_seguridad', label: 'Kit de seguridad / balizas' },
    { key: 'accesorios.cargador', label: 'Cargador / USB' },
    { key: 'accesorios.otro', label: 'Otro' },
  ],
};

/**
 * Accessory tags. In an accessory record, `item` is the tag (what kind of thing it is, to filter
 * by) and `label` is what the user wrote they installed ("Estéreo Pioneer con CarPlay").
 * `accesorios.otro` means "sin etiqueta".
 */
export const ACCESSORY_TAGS: CatalogItem[] = ACCESSORY_CATEGORY.items.filter((i) => !isOtherItem(i.key));
export const NO_ACCESSORY_TAG = `${ACCESSORY_CATEGORY.key}.${OTHER_ITEM_SUFFIX}`;

export function accessoryTag(item: string): CatalogItem | undefined {
  return ACCESSORY_TAGS.find((t) => t.key === item);
}

export const ACCESSORY_ICONS: Record<string, IconName> = {
  'accesorios.luces': 'car-light-high',
  'accesorios.alfombras': 'rug',
  'accesorios.parlantes': 'speaker',
  'accesorios.estereo': 'radio',
  'accesorios.polarizado': 'car-windshield',
  'accesorios.llantas': 'circle-double',
  'accesorios.matafuego': 'fire-extinguisher',
  'accesorios.fundas': 'seat-recline-normal',
  'accesorios.alarma': 'alarm-light',
  'accesorios.gps': 'map-marker-radius',
  'accesorios.camara': 'camera-rear',
  'accesorios.sensores': 'signal-distance-variant',
  'accesorios.dashcam': 'cctv',
  'accesorios.portaequipaje': 'bag-suitcase',
  'accesorios.enganche': 'tow-truck',
  'accesorios.cubrevolante': 'steering',
  'accesorios.kit_seguridad': 'medical-bag',
  'accesorios.cargador': 'usb-port',
  'accesorios.otro': 'dots-horizontal',
};

/* ------------------------------------------------------------------ */
/* Maintenance plan: the only jobs Careful schedules                   */
/* ------------------------------------------------------------------ */

export interface PlanItem {
  /** Catalog item key (its interval defaults live in MAINTENANCE_CATEGORIES). */
  item: string;
  icon: IconName;
  color: string;
}

/**
 * The jobs that follow a calendar (every N km or N months, whichever comes first), in the order
 * the plan and the filters show them. Everything else is logged but never scheduled.
 */
export const PLAN_ITEMS: readonly PlanItem[] = [
  { item: 'motor.aceite', icon: 'oil', color: '#E8930C' },
  { item: 'motor.filtro_aire', icon: 'air-filter', color: '#0EA5E9' },
  { item: 'climatizacion.filtro_habitaculo', icon: 'fan', color: '#14C895' },
  { item: 'motor.filtro_combustible', icon: 'gas-station', color: '#E8384F' },
  { item: 'motor.bujias', icon: 'lightning-bolt', color: '#7C5CFF' },
  { item: 'motor.distribucion', icon: 'cogs', color: '#475569' },
];

export function planItem(item: string | undefined): PlanItem | undefined {
  return item ? PLAN_ITEMS.find((p) => p.item === item) : undefined;
}

/** Plan items: scheduled, and the form asks "próximo cambio" for them. */
export function isTrackedItem(item: string): boolean {
  return !!planItem(item);
}

/** The item every vehicle is expected to track from day one. */
export const CORE_ITEM = 'motor.aceite';

/** Filters usually replaced together with the oil change: offered right on its card. */
export const OIL_CHANGE_EXTRAS: readonly string[] = ['motor.filtro_aire', 'climatizacion.filtro_habitaculo', 'motor.filtro_combustible'];

const ALL_CATEGORIES = [...MAINTENANCE_CATEGORIES, ACCESSORY_CATEGORY];
const ITEM_INDEX = new Map<string, { item: CatalogItem; category: Category }>();
for (const category of ALL_CATEGORIES) {
  for (const item of category.items) ITEM_INDEX.set(item.key, { item, category });
}

export function findItem(key: string): { item: CatalogItem; category: Category } | undefined {
  return ITEM_INDEX.get(key);
}

export function findCategory(key: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.key === key);
}

export function isOtherItem(key: string): boolean {
  return key.endsWith(`.${OTHER_ITEM_SUFFIX}`);
}

/**
 * How a logged item is named: the catalog label, except a custom job ("otro") and accessories,
 * which keep what the user wrote (an accessory's key is only its tag).
 */
export function itemName(i: { category: string; item: string; label: string }): string {
  if (isOtherItem(i.item) || i.category === ACCESSORY_CATEGORY.key) return i.label;
  return findItem(i.item)?.item.label ?? i.label;
}

/** The plan items with their catalog entry, in plan order. */
export function trackableItems(): { item: CatalogItem; category: Category; plan: PlanItem }[] {
  return PLAN_ITEMS.map((plan) => ({ ...ITEM_INDEX.get(plan.item)!, plan }));
}
