/// <reference types="jest" />
/// <reference types="node" />
import { addMonthsTo, daysBetween, formatDay, formatMoment, minDay, monthStart, relativeDays, weekStart } from '../dates';
import { formatAmount, formatAmountCompact, formatAmountInput, formatInt, formatIntInput, formatKm, parseAmountInput, parseIntInput } from '../format';

describe('numbers', () => {
  it('formats integers es-AR style', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(1234567)).toBe('1.234.567');
    expect(formatInt(-1500)).toBe('-1.500');
    expect(formatKm(48210)).toBe('48.210 km');
    expect(formatInt(null)).toBe('—');
  });

  it('formats amounts without currency symbol', () => {
    expect(formatAmount(1250000)).toBe('12.500');
    expect(formatAmount(1250050)).toBe('12.500,50');
    expect(formatAmount(5)).toBe('0,05');
    expect(formatAmountCompact(125_000_000)).toBe('1,3M');
    expect(formatAmountCompact(4_500_000)).toBe('45K');
  });

  it('parses user input', () => {
    expect(parseIntInput('48.210 km')).toBe(48210);
    expect(parseIntInput('')).toBeNull();
    expect(formatIntInput('48210')).toBe('48.210');
    expect(parseAmountInput('12.500')).toBe(1250000);
    expect(parseAmountInput('12.500,5')).toBe(1250050);
    expect(parseAmountInput('12500.50')).toBe(1250050);
    expect(parseAmountInput('1.500')).toBe(150000);
    expect(parseAmountInput('')).toBeNull();
    expect(formatAmountInput('12500,5')).toBe('12.500,5');
    expect(formatAmountInput('012')).toBe('12');
  });

  it('keeps big amounts while typing them digit by digit (the grouping dots are not decimals)', () => {
    const type = (keys: string) => [...keys].reduce((value, k) => formatAmountInput(value + k, value), '');
    expect(type('12345')).toBe('12.345');
    expect(type('1500000')).toBe('1.500.000');
    expect(type('250000000')).toBe('250.000.000');
    // the decimal key may send "." or ","
    expect(type('1234.5')).toBe('1.234,5');
    expect(type('1234,56')).toBe('1.234,56');
    expect(type('1234,567')).toBe('1.234,56');
    expect(type('1234..')).toBe('1.234,');
    // backspace regroups
    expect(formatAmountInput('12.34', '12.345')).toBe('1.234');
    // pasted
    expect(formatAmountInput('1500000.50', '')).toBe('1.500.000,50');
    expect(formatAmountInput('12.500', '')).toBe('12.500');
    expect(parseAmountInput(type('1500000'))).toBe(150_000_000);
  });
});

describe('dates', () => {
  it('does calendar math on local days', () => {
    expect(addMonthsTo('2026-01-31', 1)).toBe('2026-02-28');
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(minDay('2026-02-01', '2026-01-01')).toBe('2026-01-01');
    expect(minDay(null, '2026-01-01')).toBe('2026-01-01');
    expect(monthStart('2026-08-20')).toBe('2026-08-01');
    expect(weekStart('2026-08-20')).toBe('2026-08-17');
    expect(weekStart('2026-08-17')).toBe('2026-08-17');
    expect(weekStart('2026-08-23')).toBe('2026-08-17');
  });

  it('formats in Spanish', () => {
    expect(formatDay('2026-03-05')).toBe('5 mar 2026');
    const now = new Date(2026, 0, 10);
    expect(relativeDays('2026-01-10', now)).toBe('hoy');
    expect(relativeDays('2026-01-11', now)).toBe('mañana');
    expect(relativeDays('2026-01-20', now)).toBe('en 10 días');
    expect(relativeDays('2026-01-05', now)).toBe('hace 5 días');
    expect(relativeDays('2026-07-10', now)).toBe('en 6 meses');
  });
});

describe('formatMoment', () => {
  it('shows past instants in local time, relative when recent', () => {
    const now = new Date(2026, 10, 7, 23, 30);
    expect(formatMoment(new Date(2026, 10, 7, 21, 36).toISOString(), now)).toBe('hoy 21:36');
    expect(formatMoment(new Date(2026, 10, 6, 9, 5).toISOString(), now)).toBe('ayer 09:05');
    expect(formatMoment(new Date(2026, 10, 1, 8, 0).toISOString(), now)).toBe('1 nov 2026, 08:00');
    expect(formatMoment('nope', now)).toBe('');
  });
});
