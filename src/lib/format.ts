/**
 * Locale-stable number formatting (es-AR style: "." thousands, "," decimals).
 * Implemented by hand so the output is identical on every Android/Hermes build and in tests.
 */

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.round(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatKm(n: number | null | undefined): string {
  return n === null || n === undefined ? '— km' : `${formatInt(n)} km`;
}

/** Amount without currency symbol, as requested: "12.500" or "12.500,50". */
export function formatAmount(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const dec = abs % 100;
  return `${sign}${formatInt(whole)}${dec ? `,${dec.toString().padStart(2, '0')}` : ''}`;
}

/** Compact amount for charts: 1.2M, 350K, 900. */
export function formatAmountCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `${trimZero((v / 1_000_000).toFixed(1))}M`;
  if (Math.abs(v) >= 1_000) return `${trimZero((v / 1_000).toFixed(v >= 100_000 ? 0 : 1))}K`;
  return formatInt(v);
}

const trimZero = (s: string) => s.replace(/[.,]0$/, '').replace('.', ',');

/** Keeps only digits; returns null for empty input. */
export function parseIntInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Live formatting for integer inputs (odometer): "48210" → "48.210". */
export function formatIntInput(text: string): string {
  const n = parseIntInput(text);
  return n === null ? '' : formatInt(n);
}

/**
 * Parses user amounts. Accepts "12500", "12.500", "12.500,5", "12500,50", "12500.50".
 * A single "." followed by exactly 1-2 digits is treated as decimal separator.
 */
export function parseAmountInput(text: string): number | null {
  const t = text.replace(/[^\d.,]/g, '');
  if (!t) return null;
  let whole = t;
  let dec = '';
  const lastComma = t.lastIndexOf(',');
  if (lastComma >= 0) {
    whole = t.slice(0, lastComma);
    dec = t.slice(lastComma + 1);
  } else {
    const m = /^(.*)\.(\d{1,2})$/.exec(t);
    if (m && (m[1].match(/\./g)?.length ?? 0) === 0 && !/^\d{1,3}\.\d{3}$/.test(t)) {
      whole = m[1];
      dec = m[2];
    }
  }
  const w = whole.replace(/\D/g, '');
  const d = dec.replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
  if (!w && !dec) return null;
  const cents = Number(w || '0') * 100 + Number(d || '0');
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Whole part digits kept while typing an amount (hundreds of billions; stays a safe integer in cents). */
const MAX_AMOUNT_DIGITS = 12;

/**
 * Live formatting for amount inputs: groups thousands ("1.234.567") and keeps up to 2 decimals.
 * `prev` is the field's current value. The dots in it are thousands separators added here, so
 * they are never read as decimals; only a "." the user just typed is (the decimal key of some
 * keyboards sends "." instead of ","). Pasted text is parsed as a whole.
 */
export function formatAmountInput(text: string, prev = ''): string {
  let t = text.trim();
  const dots = (s: string) => s.split('.').length - 1;
  if (t.includes(',')) {
    // "," is always the decimal separator: every dot is a thousands separator
  } else if (t.length > prev.length + 1) {
    // pasted: "1500000.50" or "12.5" carry decimals, "12.500" is thousands (as parseAmountInput)
    const m = /^([^.]*)\.(\d{1,2})$/.exec(t);
    if (m) t = `${m[1]},${m[2]}`;
  } else if (dots(t) > dots(prev)) {
    let i = 0;
    while (i < prev.length && prev[i] === t[i]) i++;
    if (t[i] === '.') t = `${t.slice(0, i)},${t.slice(i + 1)}`;
  }
  t = t.replace(/[^\d,]/g, '');
  const [whole, ...rest] = t.split(',');
  const digits = whole.replace(/^0+(?=\d)/, '').slice(0, MAX_AMOUNT_DIGITS);
  const w = digits ? formatInt(Number(digits)) : rest.length ? '0' : '';
  return rest.length ? `${w},${rest.join('').slice(0, 2)}` : w;
}

export function formatLiters(l: number | null | undefined): string {
  if (l === null || l === undefined) return '—';
  return `${l.toString().replace('.', ',')} L`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}
