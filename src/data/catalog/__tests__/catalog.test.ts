/// <reference types="jest" />
/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

import { ACCESSORY_CATEGORY, ACCESSORY_ICONS, MAINTENANCE_CATEGORIES } from '@/domain/maintenance';

import { BRANDS, matchBrand, matchModel, modelsFor, variantsFor, yearsForBrand } from '..';

const REQUIRED = ['ford', 'chevrolet', 'volkswagen', 'toyota', 'citroen', 'peugeot', 'fiat', 'ds', 'mercedes-benz', 'renault'];

describe('vehicle catalog integrity', () => {
  it('includes the 10 brands from the spec', () => {
    expect(BRANDS.map((b) => b.id).sort()).toEqual([...REQUIRED].sort());
  });

  it.each(REQUIRED)('%s: ids unique, engines resolve, years sane', (id) => {
    const brand = BRANDS.find((b) => b.id === id)!;
    expect(brand.models.length).toBeGreaterThan(5);
    const modelIds = new Set<string>();
    const engineIds = new Set(brand.engines.map((e) => e.id));
    expect(engineIds.size).toBe(brand.engines.length);
    for (const m of brand.models) {
      expect(modelIds.has(m.id)).toBe(false);
      modelIds.add(m.id);
      expect(m.years[0]).toBeGreaterThanOrEqual(1990);
      if (m.years[1] !== null) expect(m.years[1]).toBeGreaterThanOrEqual(m.years[0]);
      expect(m.variants.length).toBeGreaterThan(0);
      for (const v of m.variants) {
        if (v.engineId) expect(engineIds.has(v.engineId)).toBe(true);
        if (v.years) expect(v.years[0]).toBeLessThanOrEqual(v.years[1] ?? 9999);
      }
    }
    for (const e of brand.engines) {
      if (e.oil) {
        expect(e.oil.liters).toBeGreaterThan(1);
        expect(e.oil.liters).toBeLessThan(15);
        expect(e.oil.viscosity).toMatch(/^\d{1,2}W-\d{2}$/);
      }
    }
  });

  it('every catalog year has at least one model with variants (no dead ends in the wizard)', () => {
    for (const b of BRANDS) {
      for (const y of yearsForBrand(b.id, new Date(2026, 5, 1))) {
        const models = modelsFor(b.id, y, new Date(2026, 5, 1));
        expect(models.length).toBeGreaterThan(0);
      }
    }
  });

  it('supports the brand → year → model → variant flow', () => {
    const years = yearsForBrand('fiat', new Date(2026, 5, 1));
    expect(years[0]).toBe(2027);
    expect(years).toContain(2000);
    const cronos = modelsFor('fiat', 2021).find((m) => m.id === 'cronos');
    expect(cronos).toBeDefined();
    expect(variantsFor(cronos!, 2021).length).toBeGreaterThan(0);
    expect(modelsFor('fiat', 2005).some((m) => m.id === 'cronos')).toBe(false);
  });

  it('matches free text to brands and models', () => {
    expect(matchBrand('VW GOL TREND')?.id).toBe('volkswagen');
    expect(matchBrand('Mercedes Benz Sprinter')?.id).toBe('mercedes-benz');
    expect(matchBrand('CITROËN C4')?.id).toBe('citroen');
    expect(matchModel('volkswagen', 'GOL TREND 1.6')?.name).toMatch(/Gol Trend/i);
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
