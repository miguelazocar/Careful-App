/// <reference types="jest" />
/// <reference types="node" />
import { flagEmoji } from '../countries';
import { colorHexFor, isLightColor } from '../colors';
import { findPlatesInText, formatPlate, isValidPlate, normalizePlate } from '../plate';
import { findVinsInText, isValidVin, normalizeVin, vinBrandId, vinModelYear } from '../vin';

describe('plates', () => {
  it('formats Argentine plates (old and Mercosur)', () => {
    expect(formatPlate('abc123')).toBe('ABC 123');
    expect(formatPlate('ab-123-cd')).toBe('AB 123 CD');
    expect(formatPlate('ABC1234', 'UY')).toBe('ABC 1234');
    expect(normalizePlate(' ab 123 cd ')).toBe('AB123CD');
    expect(isValidPlate('AB123CD')).toBe(true);
    expect(isValidPlate('A1')).toBe(false);
  });

  it('finds plates in OCR text, tolerating spaces and O/0 confusions', () => {
    expect(findPlatesInText('REPUBLICA ARGENTINA\nAE 3O7 KT')).toContain('AE307KT');
    expect(findPlatesInText('dominio: OAB 123')).toContain('OAB123');
    expect(findPlatesInText('ABC1234')).not.toContain('ABC123');
  });
});

describe('VIN', () => {
  it('validates and normalizes', () => {
    expect(isValidVin('8AP359A1XKU123456')).toBe(true);
    expect(isValidVin('8AP359A1XKU12345')).toBe(false);
    expect(normalizeVin('8ap 359a1xku12345o')).toBe('8AP359A1XKU123450');
  });

  it('decodes manufacturer and model year', () => {
    expect(vinBrandId('8AP359A1XKU123456')).toBe('fiat');
    expect(vinBrandId('9BWAB45U0LP000001')).toBe('volkswagen');
    expect(vinModelYear('8AP359A1XKU123456', 2027)).toBe(2019); // K
    expect(vinModelYear('8AFXXXXXXYX000000', 2027)).toBe(2000); // Y
    expect(vinModelYear('8AFXXXXXX5X000000', 2027)).toBe(2005);
    expect(vinModelYear('8AFXXXXXXSX000000', 2027)).toBe(2025);
    expect(vinModelYear('8AFXXXXXXXX000000', 2027)).toBe(1999); // X = 2029 → 1999
  });

  it('finds VINs in OCR text', () => {
    expect(findVinsInText('CHASIS N° 8AP359A1XKU123456 MOTOR 552')).toContain('8AP359A1XKU123456');
  });
});

describe('misc', () => {
  it('builds flag emojis', () => {
    expect(flagEmoji('AR')).toBe('🇦🇷');
    expect(flagEmoji('xx1')).toBe('🏳️');
  });
  it('maps color names', () => {
    expect(colorHexFor('blanco')).toBe('#F5F6F8');
    expect(colorHexFor('Gris plata metalizado')).toBeTruthy();
    expect(isLightColor('#F5F6F8')).toBe(true);
    expect(isLightColor('#1B1D21')).toBe(false);
  });
});
