/// <reference types="jest" />
import { describeMissing, mergeFluids, missingFluidFields, type FluidData } from '../fluids';

const catalog: FluidData = { oilType: '5W-30 · ACEA C2', oilLiters: 3.2, coolantType: 'OAT · rosa', source: 'Catálogo Careful' };
const gemini: FluidData = { oilType: '5W-40', oilLiters: 3.5, coolantType: 'Paraflu UP', coolantLiters: 5.5, source: 'Gemini', notes: 'Manual Fiat' };

describe('missingFluidFields', () => {
  it('lists empty, zero or absent values', () => {
    expect(missingFluidFields(null)).toEqual(['oilType', 'oilLiters', 'coolantType', 'coolantLiters']);
    expect(missingFluidFields(catalog)).toEqual(['coolantLiters']);
    expect(missingFluidFields({ source: 'x', oilType: '  ', oilLiters: 0 })).toEqual(['oilType', 'oilLiters', 'coolantType', 'coolantLiters']);
  });
  it('describes the gaps in Spanish', () => {
    expect(describeMissing(['coolantLiters'])).toBe('capacidad de refrigerante');
    expect(describeMissing(['oilType', 'oilLiters', 'coolantType'])).toBe('tipo de aceite, capacidad de aceite ni tipo de refrigerante');
  });
});

describe('mergeFluids', () => {
  it('keeps catalog values and only fills the gaps from the AI', () => {
    const r = mergeFluids(catalog, gemini);
    expect(r).toMatchObject({ oilType: '5W-30 · ACEA C2', oilLiters: 3.2, coolantType: 'OAT · rosa', coolantLiters: 5.5 });
    expect(r?.source).toBe('Catálogo Careful + Gemini');
    expect(r?.notes).toBe('Manual Fiat');
  });

  it('uses the AI alone when the catalog has nothing', () => {
    expect(mergeFluids(null, gemini)).toBe(gemini);
    expect(mergeFluids(null, { source: 'Gemini' })).toBeNull();
    expect(mergeFluids(null, null)).toBeNull();
  });

  it('does not mention the AI when it added nothing', () => {
    const full: FluidData = { ...catalog, coolantLiters: 6 };
    expect(mergeFluids(full, gemini)).toBe(full);
    expect(mergeFluids(catalog, { source: 'Gemini' })).toBe(catalog);
  });
});

describe('mergeFluids extras', () => {
  it('keeps extra details (base, concentration, product) even when the core values were complete', () => {
    const full: FluidData = { ...catalog, coolantLiters: 6 };
    const r = mergeFluids(full, { source: 'Gemini', oilBrand: 'Selenia', coolantConcentration: 50 });
    expect(r).toMatchObject({ oilBrand: 'Selenia', coolantConcentration: 50, source: 'Catálogo Careful' });
  });
});
