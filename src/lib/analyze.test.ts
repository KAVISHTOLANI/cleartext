import { describe, expect, it } from 'vitest';
import { analyze, applySuggestions, easeLabel, findPassive, findPlainWords, matchCase, splitSentences, syllables } from './analyze';

describe('sentences and syllables', () => {
  it('splits sentences without breaking on abbreviations or decimals', () => {
    const s = splitSentences('Dr. Smith arrived at 3.5 pm. Was it late? Yes! e.g. later, we left.');
    expect(s.map((x) => x.text)).toEqual(['Dr. Smith arrived at 3.5 pm.', 'Was it late?', 'Yes!', 'e.g. later, we left.']);
    expect(s[0].start).toBe(0);
  });
  it('estimates syllables', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('table')).toBe(2);
    expect(syllables('organisation')).toBe(5);
    expect(syllables('readability')).toBe(5);
  });
});

describe('findings', () => {
  it('detects passive voice with and without “by”', () => {
    expect(findPassive('The form was completed by the applicant.').map((f) => f.text)).toEqual(['was completed']);
    expect(findPassive('Mistakes were quickly made.')[0].text).toBe('were quickly made');
    expect(findPassive('She is tired and we need help.')).toHaveLength(1); // "is tired" — a known false positive of the heuristic
    expect(findPassive('We completed the form.')).toEqual([]);
  });
  it('suggests plain words, longest phrase first, preserving case', () => {
    const f = findPlainWords('In order to commence, Utilize the form prior to Friday.');
    expect(f.map((x) => [x.text, x.suggestion])).toEqual([['In order to', 'To'], ['commence', 'start'], ['Utilize', 'Use'], ['prior to', 'before']]);
    expect(matchCase('PURCHASE', 'buy')).toBe('BUY');
  });
  it('analyses length, readability and applies suggestions', () => {
    const long = 'This sentence is deliberately written to be far too long because it keeps adding clauses and more clauses so that the reader has to hold many ideas in their head at once before reaching the end.';
    const a = analyze(long + ' It ends.');
    expect(a.findings.some((f) => f.kind === 'long-sentence' || f.kind === 'very-long-sentence')).toBe(true);
    expect(a.sentences).toHaveLength(2);
    expect(easeLabel(85)).toBe('Very easy');
    expect(easeLabel(null)).toBe('—');
    const t = 'Please utilise the portal in order to purchase tickets.';
    expect(applySuggestions(t, analyze(t).findings)).toBe('Please use the portal to buy tickets.');
    expect(analyze('').readingEase).toBeNull();
  });
});
