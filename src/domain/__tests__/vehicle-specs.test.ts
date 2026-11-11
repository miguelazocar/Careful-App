/// <reference types="jest" />
import { coolantMix, fuelLabel, guessCoolantBase, guessOilBase, engineFromVersion } from '../vehicle-specs';

describe('coolantMix', () => {
  it('splits the total capacity into coolant and demineralized water', () => {
    expect(coolantMix(6, 40)).toEqual({ coolant: 2.4, water: 3.6 });
    expect(coolantMix(5.5, 50)).toEqual({ coolant: 2.75, water: 2.75 });
    expect(coolantMix(7, 30)).toEqual({ coolant: 2.1, water: 4.9 });
    expect(coolantMix(6.2, 60)).toEqual({ coolant: 3.72, water: 2.48 });
  });
  it('needs a capacity and a valid percentage', () => {
    expect(coolantMix(null, 40)).toBeNull();
    expect(coolantMix(6, null)).toBeNull();
    expect(coolantMix(0, 40)).toBeNull();
    expect(coolantMix(6, 100)).toBeNull();
  });
});

describe('labels and guesses', () => {
  it('shows the fuel as the user names it', () => {
    expect(fuelLabel('nafta')).toBe('Gasolina');
    expect(fuelLabel('gnc')).toBe('GNC');
    expect(fuelLabel('diesel')).toBe('Diésel');
    expect(fuelLabel('hibrido')).toBe('Híbrido');
    expect(fuelLabel(null)).toBeNull();
  });

  it('guesses the oil base from the SAE grade', () => {
    expect(guessOilBase('5W-30 · ACEA C2')).toBe('sintetico');
    expect(guessOilBase('0w20')).toBe('sintetico');
    expect(guessOilBase('10W-40')).toBe('semisintetico');
    expect(guessOilBase('15W-40 API CI-4')).toBe('mineral');
    expect(guessOilBase('20W50')).toBe('mineral');
    expect(guessOilBase('Selenia')).toBeNull();
  });

  it('guesses the coolant technology from its description', () => {
    expect(guessCoolantBase('Orgánico (OAT) rosa')).toBe('organico');
    expect(guessCoolantBase('G12+')).toBe('organico');
    expect(guessCoolantBase('HOAT · amarillo')).toBe('hibrido');
    expect(guessCoolantBase('Si-OAT G13')).toBe('hibrido');
    expect(guessCoolantBase('Inorgánico verde')).toBe('inorganico');
    expect(guessCoolantBase('Paraflu UP')).toBeNull();
    expect(guessCoolantBase('')).toBeNull();
  });
});

describe('engineFromVersion', () => {
  it('reads displacement and engine codes from a catalog version', () => {
    expect(engineFromVersion('5P 1,4 FIRE TOP')).toBe('1.4 L · FIRE');
    expect(engineFromVersion('4P 2,0 TDI 140CV DSG')).toBe('2.0 L · TDI');
    expect(engineFromVersion('5P 1.6 16V THP')).toBe('1.6 L · 16V THP');
    expect(engineFromVersion('D/C 2,8 TD 4X4')).toBe('2.8 L');
    expect(engineFromVersion('5P HIGHLINE')).toBeNull();
    expect(engineFromVersion(null)).toBeNull();
  });
});
