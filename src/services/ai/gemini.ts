import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';

import { fuelFromVersion, getBrand, matchBrand, matchModel, transmissionFromVersion } from '@/data/catalog';
import { VEHICLE_COLORS } from '@/domain/colors';
import { normalizePlate } from '@/domain/plate';
import { engineFromVersion, guessCoolantBase, guessOilBase } from '@/domain/vehicle-specs';
import { normalizeVin } from '@/domain/vin';
import { getSettings } from '@/stores/settings';

import { AiUnavailableError, type AiProvider, type FluidQuery, type FluidSuggestion, type VehicleGuess } from './types';

const KEY_STORE = 'careful.gemini.apiKey';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 45_000;

export async function getGeminiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_STORE);
}

export async function saveGeminiKey(key: string | null): Promise<void> {
  if (key) await SecureStore.setItemAsync(KEY_STORE, key.trim());
  else await SecureStore.deleteItemAsync(KEY_STORE);
}

/** Validates a key by listing models. Returns null when OK, else a human-readable error. */
export async function testGeminiKey(key: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${ENDPOINT}/models?pageSize=1`, {
      headers: { 'x-goog-api-key': key.trim() },
    });
    if (res.ok) return null;
    if (res.status === 400 || res.status === 401 || res.status === 403) return 'La clave no es válida o no tiene acceso a la API de Gemini.';
    return `Gemini respondió con un error (${res.status}).`;
  } catch {
    return 'No se pudo conectar con Gemini. Revisá tu conexión.';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function generate(parts: Part[], opts: { json?: boolean; search?: boolean } = {}): Promise<string> {
  return (await call(parts, opts)).text;
}

type Source = { title: string; url: string };

/** Gemini request; with `search` it also returns the web pages Google Search grounded the answer on. */
async function call(parts: Part[], opts: { json?: boolean; search?: boolean } = {}): Promise<{ text: string; sources: Source[] }> {
  const key = await getGeminiKey();
  if (!key) throw new AiUnavailableError('Configurá tu clave de Gemini en Ajustes › Inteligencia artificial.');
  const model = getSettings().ai.model || 'gemini-flash-latest';
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.2, ...(opts.json && !opts.search ? { responseMimeType: 'application/json' } : {}) },
  };
  if (opts.search) body.tools = [{ google_search: {} }];
  const res = await fetchWithTimeout(`${ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 400 && detail.includes('API key')) throw new AiUnavailableError('La clave de Gemini no es válida.');
    throw new GeminiHttpError(res.status, apiErrorMessage(detail));
  }
  const data = (await res.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string; thought?: boolean }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    }[];
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error(`Gemini no devolvió resultados${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}.`);
  const sources: Source[] = [];
  for (const c of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const title = c.web?.title?.trim();
    if (title && c.web?.uri && !sources.some((s) => s.title === title)) sources.push({ title, url: c.web.uri });
  }
  return { text, sources: sources.slice(0, 5) };
}

/** HTTP failure from the Gemini API, with a readable message. */
export class GeminiHttpError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(
      status === 429
        ? 'Se alcanzó el límite de uso de Gemini. Probá en unos minutos.'
        : `Gemini no pudo procesar la solicitud (${status}${detail ? `: ${detail}` : ''}).`,
    );
    this.name = 'GeminiHttpError';
  }
}

function apiErrorMessage(body: string): string {
  try {
    const msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? '';
    return msg.length > 140 ? `${msg.slice(0, 137)}…` : msg;
  } catch {
    return '';
  }
}

/**
 * Google Search grounding is not included in every plan (e.g. some free keys). Once it fails,
 * the rest of the session answers from the model's own knowledge instead.
 */
let searchUnavailable = false;

const FUEL_WORD: Record<string, string> = { nafta: 'nafta', diesel: 'diésel', gnc: 'GNC', hibrido: 'híbrido', electrico: 'eléctrico' };
const GEARBOX_WORD: Record<string, string> = { manual: 'manual', automatica: 'automática', cvt: 'CVT', dsg: 'DSG (doble embrague)' };

function fluidsPrompt(q: FluidQuery, brand: string, withSearch: boolean): string {
  const fuelKey = q.fuel ?? (q.variant ? fuelFromVersion(q.variant) : null);
  const gearbox = q.variant ? transmissionFromVersion(q.variant) : undefined;
  const engine = engineFromVersion(q.variant);
  const facts = [
    `- Marca: ${brand}`,
    `- Modelo: ${q.model}`,
    q.variant ? `- Versión: ${q.variant}` : null,
    q.year ? `- Año modelo: ${q.year}` : null,
    engine ? `- Motor (según la versión): ${engine}` : null,
    fuelKey ? `- Combustible: ${FUEL_WORD[fuelKey] ?? fuelKey}` : null,
    gearbox ? `- Caja: ${GEARBOX_WORD[gearbox] ?? gearbox}` : null,
    '- Mercado: Argentina',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    'Sos un asesor técnico de mantenimiento automotor. Necesito los fluidos de servicio que especifica el FABRICANTE para este vehículo exacto:\n' +
    facts +
    '\n\n' +
    (withSearch
      ? 'Investigá en internet usando solo fuentes fiables, en este orden de preferencia: 1) manual del propietario o plan de mantenimiento oficial; ' +
        '2) sitio oficial de la marca en Argentina o en el país de fabricación; 3) buscadores oficiales de lubricantes (Shell, YPF Elaion, Castrol, Mobil, Total, Petronas, Motul, Liqui Moly); ' +
        '4) fichas técnicas de concesionarios oficiales. No uses foros, redes sociales ni sitios de usuarios. Contrastá al menos dos fuentes cuando sea posible.\n'
      : 'Respondé con los datos del fabricante que conozcas para este motor.\n') +
    'Primero identificá el motor exacto (familia y código) a partir de la versión y el año, y usá los datos de ESE motor. ' +
    'Si la versión exacta no figura, usá el mismo motor en años cercanos o en Brasil/Mercosur y aclaralo en "notes". ' +
    'Completá todos los campos con el dato más fiable que encuentres; usá null solo si no existe ningún dato verificable. No inventes.\n\n' +
    'Respondé SOLO un objeto JSON, sin texto antes ni después:\n' +
    '{"engine": string|null (motor identificado, ej "1.4 Fire Evo 8V"), ' +
    '"oilType": string|null (viscosidad SAE y norma, ej "5W-30 · ACEA C2"), ' +
    '"oilBase": "mineral"|"semisintetico"|"sintetico"|null, "oilLiters": number|null (capacidad con cambio de filtro, en litros), ' +
    '"oilBrand": string|null y "oilModel": string|null (aceite que recomienda o usa de fábrica la marca, ej "Selenia" y "K Pure Energy"), ' +
    '"oilIntervalKm": number|null (km entre cambios de aceite en uso normal según el fabricante), "oilIntervalMonths": number|null (meses entre cambios), ' +
    '"coolantType": string|null (norma y color, ej "G12+ · rosa"), "coolantBase": "inorganico"|"organico"|"hibrido"|null, ' +
    '"coolantLiters": number|null (capacidad total del sistema, en litros), "coolantConcentration": 30|40|50|60|null (% de refrigerante recomendado; el resto es agua desmineralizada), ' +
    '"coolantBrand": string|null y "coolantModel": string|null (refrigerante recomendado), ' +
    '"notes": string (máximo 160 caracteres: de dónde sale cada dato o qué se asumió)}'
  );
}

const cleanText = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : undefined);
const oneOf = (v: unknown, allowed: string[]) => {
  const k = typeof v === 'string' ? v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '') : '';
  return allowed.includes(k) ? k : undefined;
};

export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Respuesta de IA sin datos.');
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

async function imagePart(uri: string): Promise<Part> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1280 });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  const data = saved.base64 ?? (await new File(saved.uri).base64());
  return { inline_data: { mime_type: 'image/jpeg', data } };
}

interface RawGuess {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | string | null;
  vin?: string | null;
  engineNumber?: string | null;
  color?: string | null;
}

function toGuess(raw: RawGuess): VehicleGuess {
  const out: VehicleGuess = {};
  if (raw.plate) out.plate = normalizePlate(raw.plate);
  if (raw.vin) out.vin = normalizeVin(raw.vin);
  if (raw.engineNumber) out.engineNumber = String(raw.engineNumber).toUpperCase().replace(/\s+/g, '');
  const year = Number(raw.year);
  if (Number.isInteger(year) && year > 1950 && year < 2100) out.year = year;
  if (raw.brand) {
    const b = matchBrand(raw.brand);
    out.brand = b?.name ?? raw.brand;
    if (b) out.brandId = b.id;
  }
  if (raw.model) {
    const m = out.brandId ? matchModel(out.brandId, raw.model) : undefined;
    out.model = m?.name ?? raw.model;
    if (m) out.modelId = m.id;
  }
  if (raw.variant) out.variant = raw.variant;
  if (raw.color) {
    const c = VEHICLE_COLORS.find((x) => x.name.toLowerCase() === String(raw.color).toLowerCase());
    out.color = c?.name ?? raw.color;
  }
  return out;
}

const COLOR_LIST = VEHICLE_COLORS.map((c) => c.name).join(', ');

export const geminiProvider: AiProvider = {
  id: 'gemini',
  label: 'Gemini (nube)',

  async scanRegistration(uri) {
    const text = await generate(
      [
        {
          text:
            'Sos un asistente que lee documentos de vehículos (cédula verde/azul de Argentina u otros títulos). ' +
            'Extraé los datos del vehículo de la imagen y respondé SOLO JSON con estas claves: ' +
            '{"plate": string|null (dominio/patente sin espacios), "brand": string|null, "model": string|null, ' +
            '"variant": string|null (versión/motor), "year": number|null (año modelo), "vin": string|null (N° de chasis), ' +
            '"engineNumber": string|null (N° de motor), "color": string|null}. No inventes datos: si no se lee, null.',
        },
        await imagePart(uri),
      ],
      { json: true },
    );
    return toGuess(extractJson<RawGuess>(text));
  },

  async analyzeVehiclePhoto(uri) {
    const text = await generate(
      [
        {
          text:
            'Analizá la foto de este auto. Respondé SOLO JSON: {"plate": string|null (patente visible, sin espacios), ' +
            `"color": string|null (uno de: ${COLOR_LIST}), "brand": string|null, "model": string|null}. ` +
            'Si algo no se ve con claridad, usá null.',
        },
        await imagePart(uri),
      ],
      { json: true },
    );
    return toGuess(extractJson<RawGuess>(text));
  },

  async researchFluids(q): Promise<FluidSuggestion | null> {
    const brand = getBrand(q.brandId)?.name ?? q.brand;
    const ask = (withSearch: boolean) => call([{ text: fluidsPrompt(q, brand, withSearch) }], withSearch ? { search: true } : { json: true });
    let viaSearch = !searchUnavailable;
    let res: { text: string; sources: Source[] };
    try {
      res = await ask(viaSearch);
    } catch (e) {
      // Only the web search is optional: a bad key or no connection must surface as-is.
      if (!viaSearch || !(e instanceof GeminiHttpError)) throw e;
      searchUnavailable = true;
      viaSearch = false;
      res = await ask(false);
    }
    const raw = extractJson<{
      engine?: string | null;
      oilIntervalKm?: number | string | null;
      oilIntervalMonths?: number | string | null;
      oilType?: string | null;
      oilBase?: string | null;
      oilLiters?: number | string | null;
      oilBrand?: string | null;
      oilModel?: string | null;
      coolantType?: string | null;
      coolantBase?: string | null;
      coolantLiters?: number | string | null;
      coolantConcentration?: number | string | null;
      coolantBrand?: string | null;
      coolantModel?: string | null;
      notes?: string | null;
    }>(res.text);
    const int = (v: unknown, min: number, max: number) => {
      const n = typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
    };
    const num = (v: unknown) => {
      const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
      return Number.isFinite(n) && n > 0 && n < 40 ? n : undefined;
    };
    const out: FluidSuggestion = {
      oilType: raw.oilType ?? undefined,
      oilLiters: num(raw.oilLiters),
      coolantType: raw.coolantType ?? undefined,
      coolantLiters: num(raw.coolantLiters),
      oilBase: oneOf(raw.oilBase, ['mineral', 'semisintetico', 'sintetico']) ?? guessOilBase(raw.oilType) ?? undefined,
      oilBrand: cleanText(raw.oilBrand),
      oilModel: cleanText(raw.oilModel),
      coolantBase: oneOf(raw.coolantBase, ['inorganico', 'organico', 'hibrido']) ?? guessCoolantBase(raw.coolantType) ?? undefined,
      coolantConcentration: [30, 40, 50, 60].find((p) => p === Number(raw.coolantConcentration)),
      coolantBrand: cleanText(raw.coolantBrand),
      coolantModel: cleanText(raw.coolantModel),
      oilIntervalKm: int(raw.oilIntervalKm, 1000, 50000),
      oilIntervalMonths: int(raw.oilIntervalMonths, 1, 48),
      engine: cleanText(raw.engine),
      source: viaSearch ? 'Gemini + búsqueda web' : 'Gemini (sin búsqueda web)',
      sources: res.sources.length ? res.sources : undefined,
      notes: raw.notes?.trim() || 'Verificá siempre en el manual del vehículo.',
    };
    return out.oilType || out.coolantType || out.oilLiters || out.coolantLiters ? out : null;
  },

  async improveText(text, context) {
    const out = await generate([
      {
        text:
          'Reescribí esta nota de mantenimiento vehicular en español rioplatense, en formato técnico, breve y directo, ' +
          'como lo escribiría un jefe de taller. Usá viñetas "• " si hay más de una tarea. No agregues información que no esté ' +
          'en el texto, no uses markdown ni títulos, no incluyas montos.' +
          (context.items.length ? ` Tareas seleccionadas: ${context.items.join(', ')}.` : '') +
          `\n\nNota original:\n${text}`,
      },
    ]);
    return out.trim().replace(/^["']|["']$/g, '');
  },
};
