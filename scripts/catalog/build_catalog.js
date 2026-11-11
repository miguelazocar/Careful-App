/**
 * Merges the parsed CCA price lists (2011, 2016, 2021, 2026 editions → model years 1997–2026)
 * into Careful's catalog: one JSON per brand in src/data/catalog/brands/.
 * Only names and the years each version was on the market are kept (never prices).
 *
 * usage: node build_catalog.js <dir with parsed_*.json> <repo>
 */
const fs = require('fs');
const path = require('path');

const [dir, repo] = process.argv.slice(2);
const outDir = path.join(repo, 'src/data/catalog/brands');
const files = fs.readdirSync(dir).filter((f) => /^parsed_.*\.json$/.test(f));
const lists = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.listYear - b.listYear);
const LATEST = Math.max(...lists.map((l) => l.listYear));

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slug = (s) => norm(s).replace(/ /g, '-');

/* ------------------------------- brands ------------------------------- */
const BRAND_NAMES = {
  'ALFA ROMEO': 'Alfa Romeo',
  'MERCEDES BENZ': 'Mercedes-Benz',
  'DS AUTOMOBILES': 'DS',
  'MINI COOPER': 'Mini',
  CITROEN: 'Citroën',
  'G.A.Z.': 'GAZ',
  'LYNK&CO': 'Lynk & Co',
  McLAREN: 'McLaren',
  SSANGYONG: 'SsangYong',
  'GREAT WALL': 'Great Wall',
  'LAND ROVER': 'Land Rover',
};
const ACRONYM_BRANDS = new Set(['BMW', 'BYD', 'MG', 'KYC', 'FAW', 'GAC', 'JAC', 'JMC', 'JMEV', 'RAM', 'DFSK', 'BAIC', 'ARO', 'GAZ', 'DS']);
const titleCase = (s) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
const brandName = (raw) => BRAND_NAMES[raw] ?? (ACRONYM_BRANDS.has(raw) ? raw : titleCase(raw));

/* ------------------------------- models ------------------------------- */
const KEEP_UPPER_WORDS = new Set(['GTI', 'GT', 'RS', 'SW', 'SW4', 'TT', 'SUV', 'AMG', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'GLK', 'CLA', 'CLS', 'SLK', 'SLC', 'SL', 'ML', 'GL', 'CR-V', 'HR-V', 'WR-V', 'BR-V', 'ZR-V', 'CR-Z', 'RAV4', 'FJ', 'XC', 'XC40', 'XC60', 'XC90', 'V40', 'S60', 'S90', 'DS3', 'DS4', 'DS5', 'DS7', 'C3', 'C4', 'C5', 'MX-5', 'CX-5', 'CX-3', 'CX-7', 'CX-9', 'RX', 'NX', 'UX', 'ES', 'IS', 'LX', 'GX', 'ASX', 'EV', 'PHEV', 'HEV', 'II', 'III', 'IV', 'XL', 'XLS', 'ZS', 'HS', 'RX5', 'RX8', 'GTS', 'SVR', 'BRZ', 'WRX', 'STI', 'XV', 'VTC', 'H6', 'H2', 'H9', 'M2', 'M3', 'M4', 'M5', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'I3', 'I4', 'IX', 'IX3', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'R8', 'S3', 'S4', 'S5', 'RS3', 'RS4', 'RS5', 'RS6', 'TT', 'E-TRON', 'C-HR', 'GR', 'GR86', 'WRC', 'HB20', 'HB20S', 'IX35', 'I10', 'I20', 'I30', 'H1', 'H100', 'KX3', 'GS', 'GS3', 'GS4', 'EX', 'UNI-K', 'UNI-T', 'CS15', 'CS35', 'CS55', 'CS75']);
const WORDS = new Set(['GOL', 'UNO', 'FOX', 'KA', 'UP', 'UP!', 'VAN', 'NEW', 'ONE', 'SOL', 'MAX', 'PRO', 'LUX', 'KIT', 'BUS', 'CAB', 'CUP', 'ZOE', 'LEON', 'IBIZA', 'NIVA', 'BORA', 'TIPO', 'IDEA', 'MOBI', 'ARGO', 'TORO', 'KWID', 'JUKE', 'MARCH', 'NOTE', 'KICKS', 'SENTRA', 'VERSA', 'TIIDA', 'ETIOS', 'YARIS', 'PRIUS', 'HILUX', 'COROLLA', 'CRUZE', 'ONIX', 'PRISMA', 'SPIN', 'AGILE', 'CORSA', 'CLIO', 'SANDERO', 'LOGAN', 'DUSTER', 'KANGOO', 'MASTER', 'FIESTA', 'FOCUS', 'MONDEO', 'RANGER', 'ECOSPORT', 'TERRITORY', 'KUGA', 'BRONCO', 'MAVERICK', 'PALIO', 'SIENA', 'PUNTO', 'LINEA', 'STRADA', 'CRONOS', 'PULSE', 'FASTBACK', 'TITANO', 'AMAROK', 'POLO', 'VENTO', 'VIRTUS', 'NIVUS', 'TAOS', 'TERA', 'TIGUAN', 'TOUAREG', 'VOYAGE', 'SURAN', 'SAVEIRO', 'TRENDLINE', 'CADDY', 'GOLF', 'PASSAT', 'SCIROCCO', 'SHARAN', 'BEETLE', 'CROSS', 'COUNTRY', 'TREND', 'CLASSIC', 'SPORT', 'PLUS', 'CARGO', 'PICK', 'ACTIVE', 'NAVARA', 'FRONTIER', 'PARTNER', 'EXPERT', 'BOXER', 'JUMPER', 'BERLINGO', 'ELYSEE', 'PICASSO', 'AIRCROSS', 'CACTUS', 'LOUNGE']);
/**
 * Some editions fake bold by printing headings twice, which the PDF reader returns interleaved:
 * "GRAND GRAND VITARA VITARA", "307307", "F F I I T T". Undo those patterns.
 */
function undouble(raw) {
  let t = raw.trim().split(/\s+/);
  const pairs = (a) => a.length % 2 === 0 && a.length > 0 && a.every((w, i) => i % 2 === 1 || w === a[i + 1]);
  if (pairs(t)) t = t.filter((_, i) => i % 2 === 0);
  if (t.length > 1 && t.every((w) => w.length === 1)) t = [t.join('')];
  t = t.map((w) => (w.length >= 4 && w.length % 2 === 0 && w.slice(0, w.length / 2) === w.slice(w.length / 2) ? w.slice(0, w.length / 2) : w));
  return t.join(' ');
}

function prettyModel(raw) {
  const cleaned = undouble(raw)
    .replace(/\s*PICK\s*-?\s*UP\b/gi, ' ')
    .replace(/\s+-\s+/g, '-') // "C - HR" → "C-HR"
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(' ')
    .map((w) => {
      const u = w.toUpperCase();
      if (KEEP_UPPER_WORDS.has(u)) return u;
      if (/\d/.test(w) && !/^\d+$/.test(w)) return u; // codes like 2008, C4, X5 keep their case
      if (/^\d+$/.test(w)) return w;
      if (w.length <= 3 && !WORDS.has(u) && !/[AEIOU]/.test(u)) return u; // GLK, BRZ…
      if (w.length <= 2 && !WORDS.has(u)) return u; // C, A, GT
      return u[0] + u.slice(1).toLowerCase().replace(/-(\w)/g, (_, c) => '-' + c.toUpperCase());
    })
    .join(' ');
}

/* ---------------------------- spelling fixes ---------------------------- */
/** Misspellings found in the CCA lists (whole words in version names). */
const VERSION_WORD_FIXES = {
  ATTACTION: 'ATTRACTION',
  ATTRACTIO: 'ATTRACTION',
  COBRIO: 'CABRIO',
  CONFORD: 'CONFORT',
  CUOPE: 'COUPE',
  DECIGN: 'DESIGN',
  DUALOGIG: 'DUALOGIC',
  ELGANCE: 'ELEGANCE',
  EXCLUSIV: 'EXCLUSIVE',
  EXPRESION: 'EXPRESSION',
  HIDRIDO: 'HIBRIDO',
  HYBIRD: 'HYBRID',
  HYDRID: 'HYBRID',
  LIMETED: 'LIMITED',
  LIMTED: 'LIMITED',
  LOUGE: 'LOUNGE',
  LUXYRY: 'LUXURY',
  MHVE: 'MHEV',
  MILDHYBIRD: 'MILDHYBRID',
  MONENTUM: 'MOMENTUM',
  MOTTION: 'MOTION',
  PACKPAGE: 'PACKAGE',
  PAKCAGE: 'PACKAGE',
  PERFOMANCE: 'PERFORMANCE',
  PRIVELEGE: 'PRIVILEGE',
  QUADRIFOLIO: 'QUADRIFOGLIO',
  QUATTO: 'QUATTRO',
  ROLLAND: 'ROLAND',
  TECNHOLOGY: 'TECHNOLOGY',
  TITANIUN: 'TITANIUM',
  TRENDILINE: 'TRENDLINE',
  ULIMATE: 'ULTIMATE',
  IPREMIUM: 'i PREMIUM',
  MXDRIVE: 'M XDRIVE',
  MPERFORMANCE: 'M PERFORMANCE',
  MPACKAGE: 'M PACKAGE',
};
const VERSION_PHRASE_FIXES = [
  [/\bWORD CUP\b/g, 'WORLD CUP'],
  [/¨/g, '"'],
  [/\s+\/\s*/g, ' / '], // "1,0 /1.3" → "1,0 / 1.3"
];
function fixVersionSpelling(v) {
  let out = v.replace(/[A-Za-zÁÉÍÓÚÑ]+/g, (w) => VERSION_WORD_FIXES[w.toUpperCase()] ?? w);
  for (const [re, to] of VERSION_PHRASE_FIXES) out = out.replace(re, to);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Model names as people know them (the CCA spells some with spaces, typos or trims glued on).
 * Renaming to an existing name merges both models.
 */
const MODEL_RENAMES = {
  'alfa-romeo': { Mito: 'MiTo' },
  aro: { '10,1': '10.1', '10,4': '10.4', '10,9': '10.9' },
  audi: { 'Q 5 Sportback': 'Q5 Sportback', 'E-TRON': 'e-tron', 'RS E-TRON': 'RS e-tron' },
  bmw: { 7: '120' },
  byd: { 'Seal 5 Dm-I': 'Seal 5 DM-i', 'Seal U Dm-I': 'Seal U DM-i', 'Song Pro Dm-I': 'Song Pro DM-i', 'Shark Dmo': 'Shark' },
  changan: { M: 'M201' },
  chevrolet: { 'C 20': 'C20', 'D 20': 'D20', 'Spark Euv': 'Spark EUV' },
  citroen: { 'C- Elysée': 'C-Elysée', 'C 15': 'C15' },
  ds: { 3: 'DS 3', '3 Crossback': 'DS 3 Crossback', 4: 'DS 4', '7 Crossback': 'DS 7 Crossback' },
  faw: { 'X 40': 'X40' },
  ferrari: {
    'F 430': 'F430',
    'F 575': '575M',
    F575: '575M',
    'F 488': '488',
    'F 599': '599',
    'F 612': '612 Scaglietti',
    'F 812': '812',
    'F 8 Tributo': 'F8 Tributo',
    F360: '360',
    F456: '456',
    F550: '550',
  },
  ford: {
    'Ecosport Kinetic Design Attraction': 'Ecosport',
    'Fiesta Kinetic Design Attraction': 'Fiesta',
    'Fiesta Kinetic Desing': 'Fiesta',
    'Focus Kinetic Design Attraction': 'Focus',
    'Ka +': 'Ka',
  },
  honda: { Odissey: 'Odyssey' },
  hummer: { HM: 'H1' },
  hyundai: { 'Grand I 10': 'Grand i10', 'I 10': 'i10', 'I 30': 'i30', 'H 100': 'H100', 'H 350': 'H350', 'Santa FE': 'Santa Fe', 'Grand Santa FE': 'Grand Santa Fe' },
  jaguar: { 'F Pace': 'F-Pace', 'F Type': 'F-Type', 'S Type': 'S-Type', 'X Type': 'X-Type' },
  jeep: { Renagade: 'Renegade', 'Cherokee Grand': 'Grand Cherokee' },
  jetour: { 'X 70': 'X70' },
  kia: { 'Carnival Grand': 'Grand Carnival' },
  'land-rover': { 'Range Rover SE Vogue': 'Range Rover' },
  lexus: { 200: 'IS 200', 300: 'GS 300', 400: 'LS 400', 430: 'LS 430' },
  lifan: { 'X 50': 'X50', 'X 60': 'X60', 'X 70': 'X70' },
  maserati: { Quatroporte: 'Quattroporte', 'Gran Turismo': 'GranTurismo', 'Gran Sport': 'GranSport' },
  mazda: { 'B 2200': 'B2200', 'B 2500': 'B2500', 'B 2900': 'B2900', 'MX 3': 'MX-3', 'MX 5 Miata': 'MX-5 Miata', 'MX 6': 'MX-6', RX7: 'RX-7' },
  'mercedes-benz': {
    'Cle 300': 'CLE 300',
    'Cle 53': 'CLE 53',
    'E 220D': 'E 220 d',
    'GLC 350E': 'GLC 350 e',
    Eqa: 'EQA',
    Eqe: 'EQE',
    'Mercedes-Amg GT 4': 'AMG GT 4 puertas',
    'Mercedes-Amg GT C': 'AMG GT C',
    'Mercedes-Amg GT R': 'AMG GT R',
    'Mercedes-Amg GT S': 'AMG GT S',
  },
  mini: { 'Mini Cooper': 'Cooper' },
  mitsubishi: { 'L 200': 'L200', 'L 300': 'L300', 'GT 3000': '3000 GT' },
  nissan: { 'NP 300': 'NP300', 'NP 300 Frontier': 'NP300 Frontier', Xtrail: 'X-Trail' },
  porsche: { 'Taycan (electrico)': 'Taycan', '911 (992)': '911', '911 Turbo PDK': '911 Turbo' },
  renault: { 'Kangoo II Version Pasajeros': 'Kangoo II', 'Scenic II Grand': 'Grand Scenic II' },
  saab: { '9,3': '9-3', '9,5': '9-5' },
  shineray: { 'T 30': 'T30', 'T 32': 'T32', 'X 30': 'X30' },
  soueast: { 'DX 3': 'DX3' },
  subaru: { 'Forester All New': 'Forester' },
  suzuki: { Jimmy: 'Jimny' },
  toyota: { 'RAV-4': 'RAV4', BZ4X: 'bZ4X', 'Hilux Cover': 'Hilux' },
};

function renameModel(brandId, name) {
  let n = MODEL_RENAMES[brandId]?.[name] ?? name;
  if (brandId === 'bmw') n = n.replace(/^(M?\d{3}) ?I$/, '$1i').replace(/^(\d{3})E$/, '$1e');
  if (brandId === 'citroen') n = n.replace(/^C (\d)\b/, 'C$1');
  if (brandId === 'volvo') n = n.replace(/^([CSV]) (\d\d)$/, '$1$2');
  if (brandId === 'lynk-co') n = n.replace(/^Lynk&co /i, '');
  return n;
}

/** Models the CCA lists split between heading and version: Audi "S" + "3P 2,0 3 TFSI" → S3. */
function splitVersion(brandId, model, version) {
  if (brandId === 'audi' && model === 'S') {
    // the model number is the first lone digit after the displacement: "4P 3,0 T FSI 4 QUATTRO" → S4
    const t = version.split(' ');
    const disp = t.findIndex((w) => /^\d,\d$/.test(w));
    const at = t.findIndex((w, i) => i > disp && /^[3-8]$/.test(w));
    if (disp >= 0 && at > disp) return { model: `S${t[at]}`, version: t.filter((_, i) => i !== at).join(' ') };
    if (/^4P 3,0 /.test(version)) return { model: 'S4', version }; // 2010–2011 S4 listed without its number
  }
  if (brandId === 'changan' && model === 'M201') return { model, version: version.replace(/^201 /, '') };
  return { model, version };
}

/* ------------------------------ versions ------------------------------ */
/**
 * Fake bold in versions comes word by word: "5P 5P 1,4 1,4 FIRE FIRE" → "5P 1,4 FIRE".
 * One unpaired token is tolerated (the restyling year tag, "… ATTRACTION ATTRACTION 2012").
 */
function undoubleTokens(v) {
  const t = v.split(' ');
  const out = [];
  let loose = 0;
  for (let i = 0; i < t.length; ) {
    if (i + 1 < t.length && t[i] === t[i + 1]) {
      out.push(t[i]);
      i += 2;
    } else {
      out.push(t[i]);
      loose++;
      i += 1;
    }
  }
  return out.length >= 2 && loose <= 1 && out.length - loose >= 2 ? out.join(' ') : v;
}

/** "4P 1,3 DRIVE GSE 2020" → "4P 1,3 DRIVE GSE" (the CCA tags restyled vintages with a year). */
function cleanVersion(raw) {
  let v = undoubleTokens(raw.replace(/\s+/g, ' ').trim());
  const m = /^(.*\S)\s+((?:19|20)\d\d)$/.exec(v);
  if (m && /[A-Z]/i.test(m[1])) v = m[1];
  return fixVersionSpelling(v);
}

function bodyOf(modelName, versions) {
  const n = modelName.toUpperCase();
  if (/PICK|HILUX|RANGER|AMAROK|S10|STRADA|TORO|SAVEIRO|FRONTIER|NAVARA|L200|D-MAX|MARRUA|TITANO|MAVERICK|OROCH|ALASKAN|TUNLAND|POER|WINGLE|DMAX|CANTER|RAM\b/.test(n)) return 'pickup';
  const counts = {};
  const add = (k) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const v of versions) {
    const u = v.toUpperCase();
    if (/CABRIO|CONVERTIBLE|ROADSTER|SPIDER/.test(u)) add('convertible');
    else if (/^(C\/S|D\/C|C\/E|C\/D|CAB\b|CABINA)/.test(u)) add('pickup');
    else if (/FURG|FURGON|VAN\b|MINIBUS|CHASIS|UTILITARIO|CARGO|COMBI/.test(u)) add('van');
    else if (/COUPE/.test(u)) add('coupe');
    else if (/\bSW\b|RURAL|FAMILIAR|WAGON|VARIANT|SPORTWAGON|ESTATE|TOURING|AVANT|BREAK/.test(u)) add('wagon');
    else if (/MONOVOLUMEN|MINIVAN|7 AS/.test(u)) add('minivan');
    else if (/^4P/.test(u)) add('sedan');
    else if (/^(3P|5P)/.test(u)) add(/4X4|4X2|AWD|4WD|ALLGRIP|SUV/.test(u) ? 'suv' : 'hatchback');
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'sedan';
}

/* -------------------------------- merge -------------------------------- */
const brands = new Map(); // id -> {id, name, models: Map(id -> {id, name, raw, versions: Map(name -> Set(years))})}
for (const list of lists) {
  for (const b of list.brands) {
    const name = brandName(b.name);
    const id = slug(name === 'Mini' ? 'mini' : name);
    if (!brands.has(id)) brands.set(id, { id, name, models: new Map() });
    const brand = brands.get(id);
    for (const m of b.models) {
      const pretty = prettyModel(m.name);
      if (!pretty) continue;
      const baseName = renameModel(id, pretty);
      for (const v of m.versions) {
        if (!v.years.length) continue;
        const split = splitVersion(id, baseName, cleanVersion(v.name));
        const mName = split.model;
        const mid = slug(mName);
        if (!brand.models.has(mid)) brand.models.set(mid, { id: mid, name: mName, versions: new Map() });
        const model = brand.models.get(mid);
        if (list.listYear === LATEST) model.name = mName; // prefer the newest spelling
        if (!model.versions.has(split.version)) model.versions.set(split.version, new Set());
        const ys = model.versions.get(split.version);
        for (const y of v.years) ys.add(y);
      }
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(outDir, f));

let nModels = 0;
let nVersions = 0;
const index = [];
for (const brand of [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
  const models = [];
  for (const m of [...brand.models.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const variants = [...m.versions.entries()]
      .map(([name, ys]) => {
        const years = [...ys].sort((a, b) => a - b);
        const to = years[years.length - 1];
        return [name, years[0], to >= LATEST ? null : to];
      })
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'es'));
    if (!variants.length) continue;
    models.push({ id: m.id, name: m.name, body: bodyOf(m.name, variants.map((v) => v[0])), variants });
    nVersions += variants.length;
  }
  if (!models.length) continue;
  nModels += models.length;
  const file = `${brand.id}.json`;
  fs.writeFileSync(path.join(outDir, file), JSON.stringify({ id: brand.id, name: brand.name, models }) + '\n');
  index.push({ id: brand.id, name: brand.name, file, models: models.length });
}

// generated import list (static imports keep Metro/TS happy)
const ident = (id) => 'b_' + id.replace(/[^a-z0-9]/g, '_');
const ts =
  `/**\n * Generated by scripts/catalog/build_catalog.js from the CCA price lists — do not edit by hand.\n * ${index.length} brands, ${nModels} models, ${nVersions} versions (model years ${lists[0].listYear - 14}–${LATEST}).\n */\n` +
  index.map((b) => `import ${ident(b.id)} from './${b.file}';`).join('\n') +
  `\n\nimport type { CatalogBrandData } from '../types';\n\nexport const BRAND_DATA = [${index.map((b) => ident(b.id)).join(', ')}] as unknown as CatalogBrandData[];\n\nexport const CATALOG_FIRST_YEAR = ${lists[0].listYear - 14};\nexport const CATALOG_SOURCE_YEAR = ${LATEST};\n`;
fs.writeFileSync(path.join(outDir, 'index.ts'), ts);
const size = fs.readdirSync(outDir).reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`${index.length} brands, ${nModels} models, ${nVersions} versions, ${(size / 1024).toFixed(0)} KB`);
console.log(index.map((b) => `${b.name}(${b.models})`).join(', '));
