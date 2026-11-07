/**
 * Offline "Mejorar texto": turns a casual note into a short, technical, standardized description.
 * Deterministic and rule-based so it works without network or tokens. The cloud AI provider
 * (Gemini) produces richer output when configured; this is the always-available fallback.
 */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bc\/\s*/gi, 'con '],
  [/\bs\/\s*/gi, 'sin '],
  [/\bfilt\.?(?=\s)/gi, 'filtro'],
  [/\bdist\.?(?=\s|$)/gi, 'distribución'],
  [/\bamort\.?(?=\s|$)/gi, 'amortiguadores'],
  [/\bizq\.?(?=\s|$)/gi, 'izquierdo'],
  [/\bder\.(?=\s|$)/gi, 'derecho'],
  [/\baprox\.?(?=\s|$)/gi, 'aprox.'],
  [/\brep\.?(?=\s)/gi, 'reparación'],
  [/\bneum\.?(?=\s|$)/gi, 'neumáticos'],
  [/\ba\/?a\b/gi, 'aire acondicionado'],
  [/\bvtv\b/gi, 'VTV'],
  [/\bgnc\b/gi, 'GNC'],
  [/\babs\b/gi, 'ABS'],
];

const ART = String.raw`(?:(?:los|las|el|la|unos|unas|un|una)\s+)?`;
const LEAD = String.raw`^(?:se\s+)?(?:le\s+|les\s+)?`;
// "cambio del aceite" is already a noun phrase: don't treat it as the verb "cambió".
const verb = (stem: string) => new RegExp(String.raw`${LEAD}(?:${stem})\s+(?!de\b|del\b)${ART}`, 'i');

const VERB_PHRASES: [RegExp, string][] = [
  [verb('cambi(?:é|e|ó|o|amos|aron|aste)'), 'Cambio de '],
  [verb('reemplaz(?:é|e|ó|o|amos|aron)'), 'Reemplazo de '],
  [verb('puse|pusimos|pusieron|coloqu(?:é|e)|colocaron|colocamos'), 'Colocación de '],
  [verb('instal(?:é|e|ó|o|amos|aron)'), 'Instalación de '],
  [verb('revis(?:é|e|ó|o|amos|aron)|cheque(?:é|e|ó|o|aron)'), 'Revisión de '],
  [verb('arregl(?:é|e|ó|o|amos|aron)|repar(?:é|e|ó|o|amos|aron)'), 'Reparación de '],
  [verb('limpi(?:é|e|ó|o|amos|aron)'), 'Limpieza de '],
  [verb('lav(?:é|e|ó|o|amos|aron)'), 'Lavado de '],
  [verb('ajust(?:é|e|ó|o|amos|aron)'), 'Ajuste de '],
  [verb('compr(?:é|e|ó|o|amos|aron)'), 'Compra de '],
  [verb('carg(?:ué|ue|ó|o|amos|aron)'), 'Carga de '],
  [verb('hice|hicimos|hicieron'), ''],
];

const CONNECTOR = /^(?:y|e|también|tambien|además|ademas|luego|después|despues)\s+/i;

const FILLERS = [
  /\b(?:bueno|che|básicamente|basicamente|o sea|tipo que|la verdad)\b,?\s*/gi,
  /\b(?:hoy|ayer)\s+(?:fui|fuimos|llevé|lleve|llevamos)\s+(?:al|el auto al)\s+(?:taller|mecánico|mecanico)\s+(?:y\s+)?/gi,
  /\b(?:el mecánico|el mecanico|en el taller)\s+(?:me\s+)?(?:dijo que|recomendó|recomendo)\s+/gi,
  /\bme\s+(?:cobraron|salió|salio)\b[^.;\n]*/gi,
];

/** "del." / "tras." agree with the noun before them: "pastillas del." → "pastillas delanteras". */
function expandPosition(s: string): string {
  // The dot is required: plain "del" (de + el) and "tras" are prepositions.
  return s.replace(/(\p{L}+)(\s+)(del|tras)\.(?=(\s+\p{Lu})?)/giu, (_m, prev: string, sp: string, which: string, nextSentence?: string) => {
    const base = which.toLowerCase() === 'del' ? 'delanter' : 'traser';
    const w = prev.toLowerCase();
    const suffix = /as$/.test(w) ? 'as' : /(os|es)$/.test(w) ? 'os' : /a$/.test(w) ? 'a' : 'o';
    // keep the period when it also closed the sentence
    return `${prev}${sp}${base}${suffix}${nextSentence ? '.' : ''}`;
  });
}

/** Common words written without accents in quick notes. */
const ACCENTS: Record<string, string> = {
  liquido: 'líquido',
  bujias: 'bujías',
  neumaticos: 'neumáticos',
  electrico: 'eléctrico',
  electrica: 'eléctrica',
  valvulas: 'válvulas',
  revision: 'revisión',
  distribucion: 'distribución',
  direccion: 'dirección',
  suspension: 'suspensión',
  bateria: 'batería',
  calefaccion: 'calefacción',
  rotulas: 'rótulas',
  inyeccion: 'inyección',
  habitaculo: 'habitáculo',
  diagnostico: 'diagnóstico',
  mecanico: 'mecánico',
  tambien: 'también',
  ademas: 'además',
  rapido: 'rápido',
};

function fixAccents(s: string): string {
  return s.replace(/\p{L}+/gu, (w) => {
    const fixed = ACCENTS[w.toLowerCase()];
    if (!fixed) return w;
    return w[0] === w[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
  });
}

function normalizeUnits(s: string): string {
  return s
    .replace(/\b(\d{1,2})\s*w\s*-?\s*(\d{2})\b/gi, (_, a, b) => `${a}W-${b}`)
    .replace(/\bdot\s*-?\s*(5\.1|3|4|5)\b/gi, (_, n: string) => `DOT ${n}`)
    .replace(/\b(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*(?:km|kms|kilómetros|kilometros)\b/gi, (_, n: string) => {
      const v = Number(n.replace(/[.\s]/g, ''));
      return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
    })
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:lts?|litros?|l)\b\.?/gi, (_, n: string) => `${n.replace('.', ',')} L`);
}

function sentenceCase(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1');
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function improveTextLocally(raw: string): string {
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return '';
  for (const f of FILLERS) text = text.replace(f, '');
  for (const [re, rep] of ABBREVIATIONS) text = text.replace(re, rep);
  text = expandPosition(text);
  text = normalizeUnits(fixAccents(text));

  const parts = text
    .split(/\n+|;|\.\s+|\s+(?:y\s+(?:también|tambien|además|ademas|luego|despues|después)|y\s+le|también|ademas|además)\s+/i)
    .map((p) => p.trim().replace(/\.$/, ''))
    .filter((p) => p.length > 1);

  const lines = parts.map((p) => {
    let line = p;
    while (CONNECTOR.test(line)) line = line.replace(CONNECTOR, '');
    for (const [re, rep] of VERB_PHRASES) {
      if (re.test(line)) {
        line = line.replace(re, rep);
        break;
      }
    }
    return sentenceCase(line);
  });

  const unique = [...new Set(lines.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ? `${unique[0]}.` : '';
  return unique.map((l) => `• ${l}.`).join('\n');
}
