/// <reference types="jest" />
/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

import { ACCESSORY_CATEGORY, ACCESSORY_ICONS, MAINTENANCE_CATEGORIES } from '@/domain/maintenance';

import { BRANDS, fuelFromVersion, matchBrand, matchModel, modelsFor, transmissionFromVersion, variantsFor, yearsForBrand } from '..';
import { BRAND_LOGOS } from '../logos';

/** Brand ids persisted by vehicles created with the first catalog: they must keep resolving. */
const LEGACY_IDS = ['ford', 'chevrolet', 'volkswagen', 'toyota', 'citroen', 'peugeot', 'fiat', 'ds', 'mercedes-benz', 'renault'];
const JUNE_2026 = new Date(2026, 5, 1);

describe('vehicle catalog (CCA lists, Argentina)', () => {
  it('covers the Argentine market: 80+ brands including every legacy id', () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(80);
    const ids = BRANDS.map((b) => b.id);
    for (const id of LEGACY_IDS) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['honda', 'hyundai', 'kia', 'nissan', 'jeep', 'byd', 'chery', 'audi', 'bmw', 'mini', 'land-rover']) expect(ids).toContain(id);
  });

  it('ids are unique and years are sane in every brand', () => {
    for (const brand of BRANDS) {
      const modelIds = new Set<string>();
      expect(brand.models.length).toBeGreaterThan(0);
      for (const m of brand.models) {
        expect(modelIds.has(m.id)).toBe(false);
        modelIds.add(m.id);
        expect(m.variants.length).toBeGreaterThan(0);
        for (const v of m.variants) {
          expect(v.years[0]).toBeGreaterThanOrEqual(1990);
          expect(v.years[0]).toBeLessThanOrEqual(v.years[1] ?? 9999);
          expect(v.name).not.toMatch(/sd+,d$/); // no price leaked into a name
        }
      }
    }
  });

  it('every year offered leads to models and versions (no dead ends in the wizard)', () => {
    for (const b of BRANDS) {
      for (const y of yearsForBrand(b.id, JUNE_2026)) {
        const models = modelsFor(b.id, y, JUNE_2026);
        expect(models.length).toBeGreaterThan(0);
        for (const m of models) expect(variantsFor(m, y, JUNE_2026).length).toBeGreaterThan(0);
      }
    }
  });

  it('supports brand → year → model → version, with the right model years', () => {
    const years = yearsForBrand('fiat', JUNE_2026);
    expect(years[0]).toBe(2027);
    expect(years).toContain(1997);
    const cronos = modelsFor('fiat', 2021).find((m) => m.id === 'cronos');
    expect(cronos).toBeDefined();
    expect(variantsFor(cronos!, 2021).some((v) => /PRECISION/.test(v.name))).toBe(true);
    expect(modelsFor('fiat', 2015).some((m) => m.id === 'cronos')).toBe(false);
    expect(modelsFor('volkswagen', 2005).some((m) => m.id === 'gol')).toBe(true);
    expect(modelsFor('toyota', 2026).map((m) => m.id)).toEqual(expect.arrayContaining(['hilux', 'corolla', 'yaris']));
  });

  it('infers fuel and transmission from the version name', () => {
    expect(fuelFromVersion('5P 1,9 SD 3G DH / FORMAT')).toBe('diesel');
    expect(fuelFromVersion('D/C 2,8 TDI 4X4 SRV')).toBe('diesel');
    expect(fuelFromVersion('D/C 2,7 SR 4X2 NAFTA')).toBe('nafta');
    expect(fuelFromVersion('4P 1,8 HYBRID XEI eCVT')).toBe('hibrido');
    expect(fuelFromVersion('5P 1,6 GNC')).toBe('gnc');
    expect(fuelFromVersion('4P 1,3 DRIVE GSE')).toBe('nafta');
    expect(transmissionFromVersion('4P 1,3 DRIVE GSE CVT')).toBe('cvt');
    expect(transmissionFromVersion('4P 1,8 PRECISION AT')).toBe('automatica');
    expect(transmissionFromVersion('5P 1,6 HIGHLINE DSG')).toBe('dsg');
    expect(transmissionFromVersion('4P 1,3 DRIVE GSE')).toBeUndefined();
  });

  it('matches free text to brands and models', () => {
    expect(matchBrand('VW GOL TREND')?.id).toBe('volkswagen');
    expect(matchBrand('Mercedes Benz Sprinter')?.id).toBe('mercedes-benz');
    expect(matchBrand('CITROËN C4')?.id).toBe('citroen');
    expect(matchModel('volkswagen', 'GOL TREND 1.6')?.name).toMatch(/Gol Trend/i);
  });

  it('logos only reference catalog brands', () => {
    const ids = new Set(BRANDS.map((b) => b.id));
    for (const id of Object.keys(BRAND_LOGOS)) expect(ids.has(id)).toBe(true);
  });
});

describe('icons', () => {
  const glyphs = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'), 'utf8'),
  ) as Record<string, number>;

  it('every taxonomy icon exists in MaterialCommunityIcons', () => {
    const icons = [...MAINTENANCE_CATEGORIES.map((c) => c.icon), ACCESSORY_CATEGORY.icon, ...Object.values(ACCESSORY_ICONS)];
    expect(icons.filter((i) => !(i in glyphs))).toEqual([]);
  });

  it('every literal icon name used in the source exists', () => {
    const root = path.join(__dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (e.name !== '__tests__') walk(path.join(dir, e.name));
        } else if (/\.tsx?$/.test(e.name)) files.push(path.join(dir, e.name));
      }
    };
    walk(root);
    const missing = new Set<string>();
    const re = /\b(?:icon|iconActive|name|bioIcon)\s*[=:]\s*['"{]*['"]([a-z0-9-]+)['"]/g;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      if (!/Icon|icon/.test(src)) continue;
      for (const m of src.matchAll(re)) {
        const name = m[1];
        if (/^[a-z]+(-[a-z0-9]+)+$|^[a-z]+$/.test(name) && name.length > 2 && !(name in glyphs)) {
          // only report names that look like icons and are used in icon contexts
          const ctx = src.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 60);
          if (/icon|Icon/.test(ctx)) missing.add(`${path.basename(f)}: ${name}`);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
