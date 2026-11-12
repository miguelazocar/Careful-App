import { formatPlate } from '../plate';
import { findPlateStyle, PLATE_GROUPS, PLATE_STYLES, plateCountryName, plateText, resolvePlateStyle } from '../plate-styles';

describe('plate styles', () => {
  it('offers Mercosur, Chile, Perú and the 27 EU countries, with unique keys', () => {
    const keys = PLATE_STYLES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PLATE_STYLES.filter((s) => s.group === 'Mercosur' && s.design === 'mercosur').map((s) => s.country)).toEqual(['AR', 'BR', 'UY', 'PY']);
    expect(PLATE_STYLES.filter((s) => s.design === 'eu')).toHaveLength(27);
    expect(findPlateStyle('cl')?.design).toBe('cl');
    expect(findPlateStyle('pe')?.design).toBe('pe');
    expect(PLATE_STYLES.every((s) => PLATE_GROUPS.includes(s.group))).toBe(true);
  });

  it('uses the chosen design, else deduces one for vehicles saved before', () => {
    expect(resolvePlateStyle({ plateStyle: 'eu-es', country: 'AR', plate: 'AB123CD' }).key).toBe('eu-es');
    expect(resolvePlateStyle({ plateStyle: null, country: 'AR', plate: 'AB123CD' }).key).toBe('mercosur-ar');
    expect(resolvePlateStyle({ plateStyle: null, country: 'AR', plate: 'ABC123' }).key).toBe('ar-1995');
    expect(resolvePlateStyle({ plateStyle: null, country: 'CL', plate: 'BBCC12' }).key).toBe('cl');
    expect(resolvePlateStyle({ plateStyle: null, country: 'DE', plate: 'BAB1234' }).key).toBe('eu-de');
    expect(resolvePlateStyle({ plateStyle: null, country: 'US', plate: '7ABC123' }).key).toBe('otro');
    expect(resolvePlateStyle({ plateStyle: 'gone', country: 'UY', plate: null }).key).toBe('mercosur-uy');
  });

  it('formats the characters as printed on each plate', () => {
    expect(plateText(findPlateStyle('cl')!, formatPlate('BBCC12', 'CL'))).toBe('BB·CC·12');
    expect(formatPlate('ABCD123', 'PY')).toBe('ABCD 123');
    expect(formatPlate('ABC123', 'PE')).toBe('ABC-123');
    expect(formatPlate('1234BCD', 'ES')).toBe('1234 BCD');
    expect(formatPlate('AB123CD', 'FR')).toBe('AB-123-CD');
    expect(formatPlate('AB123CD', 'AR')).toBe('AB 123 CD');
  });

  it('names the plate country, but not the generic one', () => {
    expect(plateCountryName('AT')).toBe('Austria');
    expect(plateCountryName('AR')).toBe('Argentina');
    expect(plateCountryName('XX')).toBeNull();
  });
});
