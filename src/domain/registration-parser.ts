/**
 * Offline parser for the Argentine vehicle registration card ("cédula verde / azul")
 * from on-device OCR text. Works with ML Kit output (one string per block/line).
 */
import { matchBrand, matchModel, matchVariant } from '@/data/catalog';

import { findPlatesInText } from './plate';
import { findVinsInText, vinBrandId, vinModelYear } from './vin';

export interface RegistrationData {
  plate?: string;
  brandId?: string;
  brand?: string;
  modelId?: string;
  model?: string;
  variant?: string;
  engineId?: string;
  year?: number;
  vin?: string;
  engineNumber?: string;
}

export function parseRegistrationText(blocks: string[] | string, now = new Date()): RegistrationData {
  const text = Array.isArray(blocks) ? blocks.join('\n') : blocks;
  const upper = text.toUpperCase();
  const out: RegistrationData = {};

  const plates = findPlatesInText(labelValue(upper, ['DOMINIO', 'PATENTE']) ?? '') ;
  out.plate = plates[0] ?? findPlatesInText(upper)[0];

  const vinNear = labelValue(upper, ['CHASIS', 'CHASSIS', 'CARROCERIA', 'CARROCERÍA', 'VIN']);
  out.vin = (vinNear ? findVinsInText(vinNear)[0] : undefined) ?? findVinsInText(upper)[0];

  const motor = /MOTOR[^\n]*?(?:N(?:RO|°|º|O)?\.?\s*:?\s*)([A-Z0-9-]{6,})/.exec(upper);
  if (motor && motor[1] !== out.vin) out.engineNumber = motor[1].replace(/-/g, '');

  const brandText = labelValue(upper, ['MARCA']) ?? upper;
  const brand = matchBrand(brandText) ?? matchBrand(upper);
  const vinBrand = out.vin ? vinBrandId(out.vin) : null;
  if (brand) {
    out.brandId = brand.id;
    out.brand = brand.name;
  } else if (vinBrand) {
    out.brandId = vinBrand;
  }

  const yearText = labelValue(upper, ['AÑO MODELO', 'ANO MODELO', 'MODELO AÑO', 'AÑO', 'ANO']);
  const yearMatch = yearText ? /\b(19[89]\d|20[0-4]\d)\b/.exec(yearText) : null;
  const year = yearMatch ? Number(yearMatch[1]) : out.vin ? vinModelYear(out.vin, now.getFullYear() + 1) : null;
  if (year) out.year = year;

  const modelText = labelValue(upper, ['MODELO']);
  if (out.brandId) {
    const model = matchModel(out.brandId, modelText ?? upper);
    if (model) {
      out.modelId = model.id;
      out.model = model.name;
      const variant = matchVariant(model, modelText ?? upper, out.year ?? null);
      if (variant) {
        out.variant = variant.name;
        out.engineId = variant.engineId;
      }
    } else if (modelText) {
      out.model = titleCase(modelText.split(/\s+/).slice(0, 3).join(' '));
    }
  }

  return out;
}

/** Value written after a label on the same line ("MARCA: FIAT") or on the next line. */
function labelValue(text: string, labels: string[]): string | undefined {
  const lines = text.split('\n').map((l) => l.trim());
  for (const label of labels) {
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].indexOf(label);
      if (idx < 0) continue;
      const rest = lines[i]
        .slice(idx + label.length)
        .replace(/^[\s:.\-]+/, '')
        .trim();
      if (rest.length >= 2) return rest;
      if (lines[i + 1]) return lines[i + 1];
    }
  }
  return undefined;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
