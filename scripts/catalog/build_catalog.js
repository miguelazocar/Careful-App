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
  return v;
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
      const mName = prettyModel(m.name);
      if (!mName) continue;
      const mid = slug(mName);
      if (!brand.models.has(mid)) brand.models.set(mid, { id: mid, name: mName, versions: new Map() });
      const model = brand.models.get(mid);
      if (list.listYear === LATEST) model.name = mName; // prefer the newest spelling
      for (const v of m.versions) {
        if (!v.years.length) continue;
        const vName = cleanVersion(v.name);
        if (!model.versions.has(vName)) model.versions.set(vName, new Set());
        const ys = model.versions.get(vName);
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
