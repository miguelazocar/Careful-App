import { extractTextFromImage, isSupported } from 'expo-text-extractor';

import { getEngine, matchBrand } from '@/data/catalog';
import { findPlatesInText } from '@/domain/plate';
import { parseRegistrationText } from '@/domain/registration-parser';
import { improveTextLocally } from '@/domain/text-improve';

import { AiUnavailableError, type AiProvider, type FluidQuery, type FluidSuggestion, type VehicleGuess } from './types';

async function ocr(uri: string): Promise<string[]> {
  if (!isSupported) throw new AiUnavailableError('El reconocimiento de texto no está disponible en este dispositivo.');
  return extractTextFromImage(uri);
}

export function fluidsFromCatalog(q: FluidQuery): FluidSuggestion | null {
  const engine = getEngine(q.brandId, q.engineId);
  if (!engine || (!engine.oil && !engine.coolant)) return null;
  const oilType = engine.oil ? [engine.oil.viscosity, engine.oil.spec].filter(Boolean).join(' · ') : undefined;
  return {
    oilType,
    oilLiters: engine.oil?.liters,
    coolantType: engine.coolant ? [engine.coolant.type, engine.coolant.color].filter(Boolean).join(' · ') : undefined,
    coolantLiters: engine.coolant?.liters,
    source: `Catálogo Careful · motor ${engine.name}`,
    notes: 'Valores de referencia. Verificá siempre en el manual del vehículo.',
  };
}

export const localProvider: AiProvider = {
  id: 'local',
  label: 'En el teléfono',

  async scanRegistration(uri) {
    const blocks = await ocr(uri);
    return parseRegistrationText(blocks);
  },

  async analyzeVehiclePhoto(uri): Promise<VehicleGuess> {
    const blocks = await ocr(uri);
    const text = blocks.join('\n');
    const out: VehicleGuess = {};
    const plate = findPlatesInText(text)[0];
    if (plate) out.plate = plate;
    const brand = matchBrand(text);
    if (brand) {
      out.brandId = brand.id;
      out.brand = brand.name;
    }
    return out;
  },

  async researchFluids(q) {
    return fluidsFromCatalog(q);
  },

  async improveText(text) {
    return improveTextLocally(text);
  },
};
