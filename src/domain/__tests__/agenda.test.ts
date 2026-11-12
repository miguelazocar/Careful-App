import { agendaSections, MANUAL_TYPE, matchesAgendaFilter } from '../agenda';
import type { DueInfo, UpcomingItem } from '../schedule';

function item(key: string, due: Partial<DueInfo>, extra: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    key,
    source: 'service',
    vehicleId: 'v1',
    title: key,
    item: 'motor.aceite',
    due: {
      dueDate: null,
      dueKm: null,
      kmDate: null,
      effectiveDate: null,
      trigger: null,
      remainingKm: null,
      daysLeft: null,
      kmWarningDate: null,
      status: 'ok',
      progress: 0,
      ...due,
    },
    ...extra,
  };
}

describe('agendaSections', () => {
  it('lists overdue first, then one section per month in date order, then undated', () => {
    const sections = agendaSections([
      item('feb', { effectiveDate: '2027-02-03' }),
      item('undated-far', { remainingKm: 9_000 }),
      item('dec-late', { effectiveDate: '2026-12-20' }),
      item('late', { effectiveDate: '2026-10-01', status: 'overdue' }),
      item('dec-early', { effectiveDate: '2026-12-02', status: 'soon' }),
      item('undated-near', { remainingKm: 2_000 }),
      item('older', { effectiveDate: '2026-08-01', status: 'overdue' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Vencidos', 'Diciembre 2026', 'Febrero 2027', 'Sin fecha estimada']);
    expect(sections.map((s) => s.items.map((i) => i.key))).toEqual([['older', 'late'], ['dec-early', 'dec-late'], ['feb'], ['undated-near', 'undated-far']]);
  });

  it('on the same day, the closest by km goes first', () => {
    const [s] = agendaSections([item('b', { effectiveDate: '2026-12-01', remainingKm: 900 }), item('a', { effectiveDate: '2026-12-01', remainingKm: 300 })]);
    expect(s.items.map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('is empty without items', () => {
    expect(agendaSections([])).toEqual([]);
  });
});

describe('matchesAgendaFilter', () => {
  const oil = item('oil', {}, { vehicleId: 'v1', item: 'motor.aceite' });
  const plugs = item('plugs', {}, { vehicleId: 'v2', item: 'motor.bujias' });
  const vtv = item('vtv', {}, { vehicleId: 'v1', source: 'manual', item: undefined, reminderId: 'r1' });
  const all = [oil, plugs, vtv];
  const keys = (vehicleId: string | null, type: string | null) => all.filter((i) => matchesAgendaFilter(i, { vehicleId, type })).map((i) => i.key);

  it('filters by vehicle, by type, or both', () => {
    expect(keys(null, null)).toEqual(['oil', 'plugs', 'vtv']);
    expect(keys('v1', null)).toEqual(['oil', 'vtv']);
    expect(keys(null, 'motor.bujias')).toEqual(['plugs']);
    expect(keys(null, MANUAL_TYPE)).toEqual(['vtv']);
    expect(keys('v2', 'motor.aceite')).toEqual([]);
  });
});
