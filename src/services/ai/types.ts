export interface VehicleGuess {
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
  color?: string;
}

export interface FluidSuggestion {
  oilType?: string;
  oilLiters?: number;
  coolantType?: string;
  coolantLiters?: number;
  oilBase?: string;
  oilBrand?: string;
  oilModel?: string;
  coolantBase?: string;
  coolantConcentration?: number;
  coolantBrand?: string;
  coolantModel?: string;
  /** Manufacturer's oil-change interval for normal use. */
  oilIntervalKm?: number;
  oilIntervalMonths?: number;
  /** Engine the data refers to, as identified by the research ("1.4 Fire Evo 8V"). */
  engine?: string;
  /** Where the data came from, shown to the user ("Catálogo Careful", "Gemini + búsqueda web"). */
  source: string;
  /** Web pages the search actually used (site name + link). */
  sources?: { title: string; url: string }[];
  notes?: string;
}

export interface FluidQuery {
  brand: string;
  brandId: string | null;
  model: string;
  year: number | null;
  variant: string | null;
  engineId: string | null;
  fuel: string | null;
}

export type AiProviderId = 'gemini' | 'local';

/**
 * Both providers implement the same contract, so the UI never cares which one runs.
 * - gemini: Google Gemini API with the user's own key (cloud, best quality).
 * - local:  on-device ML Kit OCR + rule-based parsing + offline catalog (free, offline).
 */
export interface AiProvider {
  id: AiProviderId;
  label: string;
  scanRegistration(imageUri: string): Promise<VehicleGuess>;
  analyzeVehiclePhoto(imageUri: string): Promise<VehicleGuess>;
  researchFluids(q: FluidQuery): Promise<FluidSuggestion | null>;
  improveText(text: string, context: { items: string[] }): Promise<string>;
}

export class AiUnavailableError extends Error {}
