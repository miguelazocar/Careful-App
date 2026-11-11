/**
 * Maintenance & accessory taxonomy.
 *
 * Item keys are stable identifiers persisted in the database (`record_items.item`).
 * Never rename a key; add new ones instead. Labels can change freely.
 *
 * `intervalKm` / `intervalMonths` are generic, conservative defaults used to schedule the
 * next service ("lo que ocurra primero"). Users can override them per vehicle.
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
      { key: 'motor.aceite', label: 'Cambio de aceite', intervalKm: 10000, intervalMonths: 12 },
      { key: 'motor.aceite_relleno', label: 'Relleno de aceite' },
      { key: 'motor.filtro_aceite', label: 'Filtro de aceite' },
      { key: 'motor.filtro_aire', label: 'Filtro de aire', intervalKm: 20000, intervalMonths: 24 },
      { key: 'motor.filtro_combustible', label: 'Filtro de combustible', intervalKm: 30000, intervalMonths: 24 },
      { key: 'motor.bujias', label: 'Bujías', intervalKm: 40000, intervalMonths: 36 },
      { key: 'motor.distribucion', label: 'Kit de distribución', intervalKm: 60000, intervalMonths: 48 },
      { key: 'motor.correa_accesorios', label: 'Correa de accesorios', intervalKm: 60000, intervalMonths: 48 },
      { key: 'motor.refrigerante', label: 'Cambio de refrigerante', intervalKm: 40000, intervalMonths: 24 },
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
      { key: 'caja.aceite', label: 'Aceite de caja', intervalKm: 60000, intervalMonths: 48 },
      { key: 'caja.atf', label: 'Fluido caja automática / CVT', intervalKm: 60000, intervalMonths: 48 },
      { key: 'caja.embrague', label: 'Kit de embrague' },
      { key: 'caja.homocineticas', label: 'Homocinéticas / fuelles' },
      { key: 'caja.diferencial', label: 'Aceite de diferencial', intervalKm: 40000, intervalMonths: 36 },
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
      { key: 'frenos.liquido', label: 'Líquido de frenos', intervalKm: 40000, intervalMonths: 24 },
      { key: 'frenos.revision', label: 'Revisión de frenos', intervalKm: 20000, intervalMonths: 12 },
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
      { key: 'tren_delantero.revision', label: 'Revisión de tren delantero', intervalKm: 20000, intervalMonths: 12 },
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
      { key: 'ruedas.alineacion_balanceo', label: 'Alineación y balanceo', intervalKm: 10000, intervalMonths: 12 },
      { key: 'ruedas.rotacion', label: 'Rotación de neumáticos', intervalKm: 10000, intervalMonths: 12 },
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
      { key: 'electrico.bateria', label: 'Cambio de batería', intervalMonths: 36 },
      { key: 'electrico.bateria_carga', label: 'Carga / prueba de batería' },
      { key: 'electrico.bateria_bornes', label: 'Limpieza de bornes' },
      { key: 'electrico.alternador', label: 'Alternador' },
      { key: 'electrico.arranque', label: 'Burro de arranque' },
      { key: 'electrico.lamparas', label: 'Lámparas / ópticas' },
      { key: 'electrico.fusibles', label: 'Fusibles / cableado' },
      { key: 'electrico.escobillas', label: 'Escobillas limpiaparabrisas', intervalMonths: 12 },
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
      { key: 'climatizacion.filtro_habitaculo', label: 'Filtro de habitáculo', intervalKm: 15000, intervalMonths: 12 },
      { key: 'climatizacion.gas', label: 'Carga de gas A/C', intervalMonths: 24 },
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
      { key: 'tramites.vtv', label: 'VTV / inspección técnica', intervalMonths: 12 },
      { key: 'tramites.service_oficial', label: 'Service oficial', intervalKm: 10000, intervalMonths: 12 },
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
    { key: 'accesorios.matafuego', label: 'Matafuego', intervalMonths: 12 },
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
/* Quick mosaic: the 6 usual service groups and their frequent jobs     */
/* ------------------------------------------------------------------ */

export interface ServiceOption {
  /** Catalog item key (its category stays the one in MAINTENANCE_CATEGORIES). */
  item: string;
  icon: IconName;
}

export interface ServiceGroup {
  key: string;
  label: string;
  /** What's inside, shown under the tile. */
  hint: string;
  icon: IconName;
  color: string;
  options: ServiceOption[];
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    key: 'aceite',
    label: 'Aceite',
    hint: 'Cambio, relleno y filtros',
    icon: 'oil',
    color: '#E8930C',
    options: [
      { item: 'motor.aceite', icon: 'oil' },
      { item: 'motor.aceite_relleno', icon: 'oil-level' },
      { item: 'motor.filtro_aceite', icon: 'filter' },
      { item: 'motor.filtro_aire', icon: 'air-filter' },
      { item: 'motor.filtro_combustible', icon: 'gas-station' },
      { item: 'climatizacion.filtro_habitaculo', icon: 'fan' },
    ],
  },
  {
    key: 'refrigerante',
    label: 'Agua / Refrigerante',
    hint: 'Cambio, relleno y radiador',
    icon: 'coolant-temperature',
    color: '#0EA5E9',
    options: [
      { item: 'motor.refrigerante', icon: 'coolant-temperature' },
      { item: 'motor.refrigerante_relleno', icon: 'water-plus' },
      { item: 'motor.radiador', icon: 'radiator' },
      { item: 'motor.bomba_agua', icon: 'water-pump' },
      { item: 'motor.termostato', icon: 'thermometer' },
    ],
  },
  {
    key: 'tren_delantero',
    label: 'Tren delantero',
    hint: 'Revisión, amortiguadores, rótulas',
    icon: 'steering',
    color: '#7C5CFF',
    options: [
      { item: 'tren_delantero.revision', icon: 'clipboard-check-outline' },
      { item: 'tren_delantero.amortiguadores', icon: 'arrow-collapse-vertical' },
      { item: 'tren_delantero.rotulas', icon: 'axis-arrow' },
      { item: 'tren_delantero.extremos', icon: 'steering' },
      { item: 'tren_delantero.bujes', icon: 'circle-double' },
      { item: 'tren_delantero.bieletas', icon: 'link-variant' },
      { item: 'tren_delantero.cremallera', icon: 'car-cog' },
      { item: 'tren_delantero.rodamientos', icon: 'cog' },
    ],
  },
  {
    key: 'estetica',
    label: 'Estético / Limpieza',
    hint: 'Lavado, encerado y pulido',
    icon: 'car-wash',
    color: '#14C895',
    options: [
      { item: 'lavado.exterior', icon: 'car-wash' },
      { item: 'lavado.completo', icon: 'spray-bottle' },
      { item: 'lavado.encerado', icon: 'shimmer' },
      { item: 'carroceria.pulido', icon: 'auto-fix' },
      { item: 'tapiceria.limpieza', icon: 'car-seat' },
      { item: 'lavado.motor', icon: 'engine' },
      { item: 'lavado.detailing', icon: 'creation' },
      { item: 'lavado.ceramico', icon: 'shield-car' },
    ],
  },
  {
    key: 'ruedas',
    label: 'Ruedas',
    hint: 'Alineación, balanceo y cubiertas',
    icon: 'tire',
    color: '#475569',
    options: [
      { item: 'ruedas.alineacion_balanceo', icon: 'scale-balance' },
      { item: 'ruedas.rotacion', icon: 'autorenew' },
      { item: 'ruedas.neumaticos', icon: 'tire' },
      { item: 'ruedas.gomeria', icon: 'tools' },
      { item: 'ruedas.auxilio', icon: 'car-tire-alert' },
    ],
  },
  {
    key: 'bateria',
    label: 'Batería',
    hint: 'Cambio, carga y bornes',
    icon: 'car-battery',
    color: '#E8384F',
    options: [
      { item: 'electrico.bateria', icon: 'car-battery' },
      { item: 'electrico.bateria_carga', icon: 'battery-charging-high' },
      { item: 'electrico.bateria_bornes', icon: 'flash' },
      { item: 'electrico.alternador', icon: 'battery-sync' },
      { item: 'electrico.arranque', icon: 'car-key' },
    ],
  },
];

/** The quick group an item belongs to (for editing a record or "registrar como hecho"). */
export function groupOfItem(item: string): ServiceGroup | undefined {
  return SERVICE_GROUPS.find((g) => g.options.some((o) => o.item === item));
}

/** Items that carry a default interval (the form asks "próximo cambio" for them). */
export function isTrackedItem(item: string): boolean {
  const it = findItem(item)?.item;
  return !!(it?.intervalKm || it?.intervalMonths);
}

/** The item every vehicle is expected to track from day one. */
export const CORE_ITEM = 'motor.aceite';

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

/** Items that carry a default interval and therefore produce a "next service". */
export function trackableItems(): { item: CatalogItem; category: Category }[] {
  return [...ITEM_INDEX.values()].filter(({ item }) => item.intervalKm || item.intervalMonths);
}
