/// <reference types="jest" />
/// <reference types="node" />
import { parseRegistrationText } from '../registration-parser';
import { improveTextLocally } from '../text-improve';

describe('improveTextLocally ("Mejorar texto" offline)', () => {
  it('standardizes a casual note into technical bullet points', () => {
    const out = improveTextLocally('bueno le cambié el aceite 5w30 4 lts y el filtro. también revisaron frenos del.');
    expect(out).toContain('• Cambio de aceite 5W-30 4 L y el filtro.');
    expect(out).toContain('• Revisión de frenos delanteros.');
  });

  it('agrees position abbreviations with the noun, fixes accents and brake fluid specs', () => {
    const out = improveTextLocally('bueno le cambie las pastillas del. y tambien cambiaron el liquido de frenos dot4');
    expect(out).toBe('• Cambio de pastillas delanteras.\n• Cambio de líquido de frenos DOT 4.');
    expect(improveTextLocally('amortiguadores tras. Cambié la goma')).toContain('Amortiguadores traseros.');
    expect(improveTextLocally('cambio del aceite')).toBe('Cambio del aceite.');
  });

  it('normalizes kilometers and keeps single sentences as one line', () => {
    expect(improveTextLocally('cambie las bujias a los 40000km')).toBe('Cambio de bujías a los 40.000 km.');
  });

  it('returns empty for empty input', () => {
    expect(improveTextLocally('   ')).toBe('');
  });
});

describe('parseRegistrationText (cédula verde OCR)', () => {
  it('extracts plate, brand, model, year, VIN and engine number', () => {
    const blocks = [
      'CEDULA DE IDENTIFICACION DEL AUTOMOTOR',
      'DOMINIO: AE307KT',
      'MARCA: FIAT',
      'MODELO: CRONOS DRIVE 1.3 MT',
      'TIPO: SEDAN 4 PUERTAS',
      'AÑO MODELO: 2021',
      'MOTOR N°: 55282328 5310001',
      'CHASIS N°: 8AP359A1XMU123456',
    ];
    const out = parseRegistrationText(blocks, new Date(2026, 0, 1));
    expect(out.plate).toBe('AE307KT');
    expect(out.brandId).toBe('fiat');
    expect(out.modelId).toBe('cronos');
    expect(out.year).toBe(2021);
    expect(out.vin).toBe('8AP359A1XMU123456');
    expect(out.engineNumber).toBe('55282328');
  });

  it('falls back to VIN data when labels are missing', () => {
    const out = parseRegistrationText('xx 9BWAB45U0LP000001 yy', new Date(2026, 0, 1));
    expect(out.brandId).toBe('volkswagen');
    expect(out.year).toBe(2020);
  });
});
