/** License plate helpers. Argentina gets first-class support (both formats). */

export function normalizePlate(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const AR_OLD = /^[A-Z]{3}\d{3}$/; // ABC 123 (1995–2016)
const AR_MERCOSUR = /^[A-Z]{2}\d{3}[A-Z]{2}$/; // AB 123 CD (2016+)
const UY = /^[A-Z]{3}\d{4}$/; // ABC 1234
const BR_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/; // ABC1D23
const CL = /^[A-Z]{4}\d{2}$/; // BBBB12

const PY_MERCOSUR = /^[A-Z]{4}\d{3}$/; // ABCD 123
const PE = /^[A-Z0-9]{3}\d{3}$/; // ABC-123 / A1B-234
const ES = /^\d{4}[A-Z]{3}$/; // 1234 BCD
const FR = /^[A-Z]{2}\d{3}[A-Z]{2}$/; // AB-123-CD

export function formatPlate(raw: string | null | undefined, country = 'AR'): string {
  const p = normalizePlate(raw);
  if (!p) return '';
  if (country === 'FR' && FR.test(p)) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  if (country === 'PY' && PY_MERCOSUR.test(p)) return `${p.slice(0, 4)} ${p.slice(4)}`;
  if (country === 'PE' && PE.test(p)) return `${p.slice(0, 3)}-${p.slice(3)}`;
  if (country === 'ES' && ES.test(p)) return `${p.slice(0, 4)} ${p.slice(4)}`;
  if (AR_MERCOSUR.test(p)) return `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}`;
  if (AR_OLD.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  if (country === 'UY' && UY.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  if (country === 'CL' && CL.test(p)) return `${p.slice(0, 2)} ${p.slice(2, 4)} ${p.slice(4)}`;
  if (country === 'BR' && BR_MERCOSUL.test(p)) return p;
  return p;
}

export function isValidPlate(raw: string, country = 'AR'): boolean {
  const p = normalizePlate(raw);
  if (country === 'AR') return AR_OLD.test(p) || AR_MERCOSUR.test(p);
  return p.length >= 4 && p.length <= 10;
}

/**
 * Finds plate candidates in OCR text. Tolerates spaces/dashes and common OCR swaps
 * (O↔0, I↔1, S↔5, B↔8) in the positions where letters/digits are expected.
 */
export function findPlatesInText(text: string): string[] {
  const out = new Set<string>();
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\n ]/g, ' ');
  const tokens = cleaned.split(/\n/).flatMap((line) => {
    const compact = line.replace(/\s+/g, '');
    const words = line.split(/\s+/).filter(Boolean);
    const joined: string[] = [];
    for (let i = 0; i < words.length; i++) {
      joined.push(words[i]);
      if (i + 1 < words.length) joined.push(words[i] + words[i + 1]);
      if (i + 2 < words.length) joined.push(words[i] + words[i + 1] + words[i + 2]);
    }
    return [compact, ...joined];
  });

  const toLetter = (c: string) => ({ '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z' })[c] ?? c;
  const toDigit = (c: string) => ({ O: '0', I: '1', S: '5', B: '8', Z: '2', D: '0', Q: '0' })[c] ?? c;
  const coerce = (s: string, mask: string) =>
    s
      .split('')
      .map((c, i) => (mask[i] === 'L' ? toLetter(c) : toDigit(c)))
      .join('');

  for (const tok of tokens) {
    for (let i = 0; i + 6 <= tok.length; i++) {
      const seven = tok.slice(i, i + 7);
      if (seven.length === 7) {
        const m = coerce(seven, 'LLDDDLL');
        if (AR_MERCOSUR.test(m)) out.add(m);
      }
      const six = tok.slice(i, i + 6);
      const o = coerce(six, 'LLLDDD');
      if (AR_OLD.test(o) && (tok.length === 6 || i + 6 === tok.length || !/[0-9]/.test(tok[i + 6] ?? ''))) out.add(o);
    }
  }
  // Prefer Mercosur matches (more specific) first.
  return [...out].sort((a, b) => b.length - a.length);
}
