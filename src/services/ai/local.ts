import { requireOptionalNativeModule } from 'expo';

import { getEngine, matchBrand } from '@/data/catalog';
import { findPlatesInText } from '@/domain/plate';
import { guessCoolantBase, guessOilBase } from '@/domain/vehicle-specs';
import { parseRegistrationText } from '@/domain/registration-parser';
import { improveTextLocally } from '@/domain/text-improve';

import { AiUnavailableError, type AiProvider, type FluidQuery, type FluidSuggestion, type VehicleGuess } from './types';

/**
 * ML Kit OCR from expo-text-extractor, loaded as an optional native module: it isn't part of
 * Expo Go, and importing the package there would crash the app at startup.
 */
const TextExtractor = requireOptionalNativeModule<{ isSupported: boolean; extractTextFromImage(path: string): Promise<string[]> }>('ExpoTextExtractor');

async function ocr(uri: string): Promise<string[]> {
  if (!TextExtractor?.isSupported) throw new AiUnavailableError('El reconocimiento de texto no está disponible en esta versión de la app.');
  return TextExtractor.extractTextFromImage(uri.replace('file://', ''));
}

export function fluidsFromCatalog(q: FluidQuery): FluidSuggestion | null {
  const engine = getEngine(q.brandId, q.engineId);
  if (!engine || (!engine.oil && !engine.coolant)) return null;
  const oilType = engine.oil ? [engine.oil.viscosity, engine.oil.spec].filter(Boolean).join(' · ') : undefined;
  const coolantType = engine.coolant ? [engine.coolant.type, engine.coolant.color].filter(Boolean).join(' · ') : undefined;
  return {
    oilType,
    oilLiters: engine.oil?.liters,
    oilBase: guessOilBase(oilType) ?? undefined,
    coolantType,
    coolantLiters: engine.coolant?.liters,
    coolantBase: guessCoolantBase(coolantType) ?? undefined,
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
