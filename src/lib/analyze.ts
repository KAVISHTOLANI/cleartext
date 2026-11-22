export const PLAIN: Record<string, string> = {
  utilize: 'use', utilise: 'use', utilization: 'use', commence: 'start', commencement: 'start', terminate: 'end', approximately: 'about',
  'in order to': 'to', 'prior to': 'before', subsequently: 'later', facilitate: 'help', endeavour: 'try', endeavor: 'try', sufficient: 'enough',
  numerous: 'many', demonstrate: 'show', assistance: 'help', regarding: 'about', 'with regard to': 'about', 'in relation to': 'about',
  purchase: 'buy', require: 'need', additional: 'more', ascertain: 'find out', 'at this point in time': 'now', 'due to the fact that': 'because',
  'in the event that': 'if', 'a number of': 'some', obtain: 'get', provide: 'give', remuneration: 'pay', indicate: 'show', modify: 'change',
  initiate: 'start', accordingly: 'so', notwithstanding: 'despite', henceforth: 'from now on', aforementioned: 'this', 'per annum': 'a year',
  'is able to': 'can', 'are able to': 'can', 'in respect of': 'about', 'on a regular basis': 'regularly', 'whether or not': 'whether',
};

const IRREGULAR = new Set(['been', 'done', 'given', 'taken', 'made', 'seen', 'known', 'shown', 'written', 'sent', 'built', 'paid', 'held', 'kept', 'left', 'lost', 'met', 'put', 'read', 'set', 'told', 'found', 'thought', 'brought', 'bought', 'caught', 'taught', 'chosen', 'driven', 'eaten', 'fallen', 'forgotten', 'gotten', 'hidden', 'broken', 'spoken', 'stolen', 'sold', 'won', 'begun', 'drawn', 'grown', 'thrown', 'worn', 'cut', 'hit', 'shut', 'spent', 'understood', 'led', 'fed', 'felt', 'heard', 'meant', 'said']);
const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "aren't", "wasn't", "weren't"]);
const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|etc|e\.g|i\.e|vs|approx|No|Fig)|(?:^|[\s.])[A-Za-z])\.$/i;

export interface Sentence {
  text: string;
  start: number; // offset in the source text
  end: number;
  words: number;
}

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?]+(?:[.!?]+["”’)]*|$)/g;
  let buf = '';
  let bufStart = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    if (!buf) bufStart = m.index;
    buf += m[0];
    const trimmed = buf.trimEnd();
    const next = text.slice(m.index + m[0].length);
    if (ABBREV.test(trimmed) || /\d\.$/.test(trimmed) && /^\d/.test(next)) continue;
    const lead = buf.length - buf.trimStart().length;
    const t = buf.trim();
    if (t) out.push({ text: t, start: bufStart + lead, end: bufStart + lead + t.length, words: countWords(t) });
    buf = '';
  }
  if (buf.trim()) {
    const lead = buf.length - buf.trimStart().length;
    out.push({ text: buf.trim(), start: bufStart + lead, end: bufStart + lead + buf.trim().length, words: countWords(buf) });
  }
  return out.filter((s) => s.words > 0);
}

export function words(text: string): string[] {
  return text.match(/[A-Za-z’']+(?:-[A-Za-z]+)*/g) ?? [];
}
export function countWords(text: string) {
  return words(text).length;
}

/** Heuristic English syllable count (good enough for readability estimates). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export type Kind = 'long-sentence' | 'very-long-sentence' | 'passive' | 'plain-word' | 'complex-word';

export interface Finding {
  kind: Kind;
  start: number;
  end: number;
  text: string;
  message: string;
  suggestion?: string;
}

const match = (word: string) => word.replace(/[’]/g, "'").toLowerCase();

export function findPassive(text: string): Finding[] {
  const out: Finding[] = [];
  const re = /\b([A-Za-z’']+)(\s+(?:[a-z]+ly\s+)?)([A-Za-z]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [all, be, , part] = m;
    const p = part.toLowerCase();
    if (BE.has(match(be)) && ((/ed$/.test(p) && p.length > 3 && !['need', 'feed', 'seed', 'bed', 'red', 'shed'].includes(p)) || IRREGULAR.has(p))) {
      const by = /^\s+by\b/i.test(text.slice(m.index + all.length));
      out.push({ kind: 'passive', start: m.index, end: m.index + all.length, text: all, message: `Possible passive voice: “${all}”.${by ? ' Try making the “by …” part the subject.' : ' Say who does the action.'}`, suggestion: undefined });
      re.lastIndex = m.index + be.length; // allow overlapping candidates
    } else re.lastIndex = m.index + m[1].length;
  }
  return out;
}

export function findPlainWords(text: string): Finding[] {
  const out: Finding[] = [];
  const phrases = Object.keys(PLAIN).sort((a, b) => b.length - a.length);
  const taken: [number, number][] = [];
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      out.push({ kind: 'plain-word', start: s, end: e, text: m[0], message: `“${m[0]}” has a simpler alternative.`, suggestion: matchCase(m[0], PLAIN[phrase]) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export interface Analysis {
  sentences: Sentence[];
  wordCount: number;
  avgSentence: number;
  readingEase: number | null;
  grade: number | null;
  readingMinutes: number;
  findings: Finding[];
}

export function analyze(text: string): Analysis {
  const sentences = splitSentences(text);
  const ws = words(text);
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const findings: Finding[] = [];
  for (const s of sentences) {
    if (s.words > 35) findings.push({ kind: 'very-long-sentence', start: s.start, end: s.end, text: s.text, message: `Very long sentence (${s.words} words). Split it into two or three.` });
    else if (s.words > 25) findings.push({ kind: 'long-sentence', start: s.start, end: s.end, text: s.text, message: `Long sentence (${s.words} words). Aim for under 25.` });
  }
  findings.push(...findPassive(text), ...findPlainWords(text));
  const plainSpans = findings.filter((f) => f.kind === 'plain-word');
  const re = /[A-Za-z]+/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(text))) {
    const w = m[0];
    if (w.length < 9 || syllables(w) < 4 || seen.has(w.toLowerCase())) continue;
    if (plainSpans.some((p) => m!.index >= p.start && m!.index < p.end)) continue;
    seen.add(w.toLowerCase());
    findings.push({ kind: 'complex-word', start: m.index, end: m.index + w.length, text: w, message: `“${w}” is a long word (${syllables(w)} syllables). Is there a shorter way to say it?` });
  }
  findings.sort((a, b) => a.start - b.start || b.end - a.end);
  const n = sentences.length;
  return {
    sentences,
    wordCount: ws.length,
    avgSentence: n ? ws.length / n : 0,
    readingEase: n && ws.length ? 206.835 - 1.015 * (ws.length / n) - 84.6 * (syl / ws.length) : null,
    grade: n && ws.length ? 0.39 * (ws.length / n) + 11.8 * (syl / ws.length) - 15.59 : null,
    readingMinutes: ws.length / 230,
    findings,
  };
}

export function easeLabel(score: number | null): string {
  if (score == null) return '—';
  if (score >= 80) return 'Very easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

/** Applies one or more suggestions (non-overlapping), from the end so offsets stay valid. */
export function applySuggestions(text: string, list: Finding[]): string {
  let out = text;
  for (const f of [...list].filter((x) => x.suggestion != null).sort((a, b) => b.start - a.start)) out = out.slice(0, f.start) + f.suggestion + out.slice(f.end);
  return out;
}
