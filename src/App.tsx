import { useMemo, useState } from 'react';
import { copyText, DemoTag, EmptyState, Landing, NotFound, Notice, PageHead, Shell, useFlash, usePersistentState, useRoute } from './shared/ui';
import { analyze, applySuggestions, easeLabel, type Finding, type Kind } from './lib/analyze';
import { DEMO_TEXT } from './lib/demo';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/editor', label: 'Editor' },
  { to: '/guide', label: 'How it works' },
];
const KIND: Record<Kind, { label: string; cls: string }> = {
  'very-long-sentence': { label: 'Very long sentence', cls: 'k-vlong' },
  'long-sentence': { label: 'Long sentence', cls: 'k-long' },
  passive: { label: 'Passive voice', cls: 'k-passive' },
  'plain-word': { label: 'Simpler word', cls: 'k-plain' },
  'complex-word': { label: 'Long word', cls: 'k-complex' },
};
const ORDER: Kind[] = ['very-long-sentence', 'long-sentence', 'passive', 'plain-word', 'complex-word'];

export default function App() {
  const [route] = useRoute();
  let page;
  if (route === '/') page = <Home />;
  else if (route === '/editor') page = <Editor />;
  else if (route === '/guide') page = <Guide />;
  else page = <NotFound />;
  return (
    <Shell name="ClearText" wordmark={['Clear', 'Text']} nav={NAV} route={route} cta={{ to: '/editor', label: 'Check your text' }} footerNote="Text is analysed in your browser and never sent anywhere.">
      {page}
    </Shell>
  );
}

function Highlighted({ text, findings, active, hidden, onPick }: { text: string; findings: Finding[]; active: number | null; hidden: Set<Kind>; onPick?: (i: number) => void }) {
  const visible = findings.map((f, i) => ({ f, i })).filter(({ f }) => !hidden.has(f.kind));
  const sentences = visible.filter(({ f }) => f.kind.includes('sentence'));
  const marks: { f: Finding; i: number }[] = [];
  for (const v of visible.filter(({ f }) => !f.kind.includes('sentence'))) if (!marks.some((m) => v.f.start < m.f.end && v.f.end > m.f.start)) marks.push(v);
  // Build boundaries
  const cuts = new Set([0, text.length]);
  [...sentences, ...marks].forEach(({ f }) => { cuts.add(f.start); cuts.add(f.end); });
  const pts = [...cuts].sort((a, b) => a - b);
  const out: React.ReactNode[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const seg = text.slice(a, b);
    const sen = sentences.find(({ f }) => a >= f.start && b <= f.end);
    const mk = marks.find(({ f }) => a >= f.start && b <= f.end);
    let node: React.ReactNode = seg;
    if (mk) node = <mark className={`${KIND[mk.f.kind].cls} ${active === mk.i ? 'is-active' : ''}`} onClick={() => onPick?.(mk.i)} title={mk.f.message}>{seg}</mark>;
    if (sen) node = <span className={`${KIND[sen.f.kind].cls} ${active === sen.i ? 'is-active' : ''}`} onClick={() => !mk && onPick?.(sen.i)}>{node}</span>;
    out.push(<span key={a}>{node}</span>);
  }
  return <div className="hl" aria-label="Text with highlighted issues">{out}</div>;
}

function Home() {
  const sample = DEMO_TEXT.split('\n\n')[1];
  const a = analyze(sample);
  return (
    <Landing
      eyebrow="Plain-language checker"
      title={<>Say it <em>so everyone understands.</em></>}
      lead="Paste a letter, policy or web page. ClearText highlights very long sentences, passive voice, needlessly formal words and long words, explains each one, and offers simpler wording you can apply with a click."
      primary={{ href: '#/editor', label: 'Check your text' }}
      secondary={{ href: '#/guide', label: 'How it works' }}
      previewLabel="Demo library notice · live highlights"
      preview={
        <div className="hero-ct">
          <Highlighted text={sample} findings={a.findings} active={null} hidden={new Set()} />
          <div className="hct-stats"><span><strong>{a.avgSentence.toFixed(0)}</strong> words per sentence</span><span><strong>{a.findings.filter((f) => f.kind === 'passive').length}</strong> passive</span><span><strong>{a.findings.filter((f) => f.kind === 'plain-word').length}</strong> simpler words</span></div>
        </div>
      }
      steps={[
        { title: 'Paste your text', body: 'Anything from an email to a terms page. It stays on your device.' },
        { title: 'Review the highlights', body: 'Colour-coded issues, each with a reason. Toggle types on and off.' },
        { title: 'Apply simpler wording', body: 'Accept suggestions one by one, or all at once, then copy the result.' },
      ]}
      features={[
        { title: 'Sentence length', body: 'Sentences over 25 words are flagged; over 35 are marked as very long.' },
        { title: 'Passive voice', body: 'Spots “was completed by…” patterns and suggests saying who does what.' },
        { title: 'Plainer words', body: '50+ formal words and phrases with everyday alternatives — “prior to” → “before”.' },
        { title: 'Readability estimate', body: 'Flesch reading ease and an approximate school-grade level, with their limits explained.' },
      ]}
      note="The checks are heuristics for English text. They will sometimes flag sentences that are fine — use them as prompts, not rules."
      closing={{ title: <>Make your next notice <em>easier to read.</em></>, action: { href: '#/editor', label: 'Open the editor' } }}
    />
  );
}

function Editor() {
  const [text, setText] = usePersistentState('cleartext:text', DEMO_TEXT);
  const [mode, setMode] = useState<'review' | 'edit'>('review');
  const [hidden, setHidden] = useState<Set<Kind>>(new Set());
  const [active, setActive] = useState<number | null>(null);
  const [flash, setFlash] = useFlash();
  const a = useMemo(() => analyze(text), [text]);
  const counts = Object.fromEntries(ORDER.map((k) => [k, a.findings.filter((f) => f.kind === k).length])) as Record<Kind, number>;
  const list = a.findings.map((f, i) => ({ f, i })).filter(({ f }) => !hidden.has(f.kind));
  const plain = a.findings.filter((f) => f.kind === 'plain-word');
  const toggle = (k: Kind) => { const n = new Set(hidden); if (n.has(k)) n.delete(k); else n.add(k); setHidden(n); };
  const apply = (f: Finding) => { setText(applySuggestions(text, [f])); setActive(null); setFlash({ kind: 'success', text: `Replaced “${f.text}” with “${f.suggestion}”.` }); };
  return (
    <div className="stack">
      <PageHead
        eyebrow={<>Workspace · Editor {text === DEMO_TEXT && <DemoTag />}</>}
        title={<>Plain-language <em>check</em></>}
        description={a.wordCount ? `${a.wordCount} words · ${a.sentences.length} sentences · about ${Math.max(1, Math.round(a.readingMinutes))} min to read` : 'Paste some text to begin.'}
        actions={
          <>
            <div className="seg" role="radiogroup" aria-label="Mode">
              <button type="button" role="radio" aria-checked={mode === 'review'} onClick={() => setMode('review')}>Review</button>
              <button type="button" role="radio" aria-checked={mode === 'edit'} onClick={() => setMode('edit')}>Edit</button>
            </div>
            <button type="button" className="btn" disabled={!text} onClick={async () => setFlash((await copyText(text)) ? { kind: 'success', text: 'Text copied.' } : { kind: 'error', text: 'Clipboard access was blocked.' })}>Copy text</button>
          </>
        }
      />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {!text.trim() ? (
        <div className="stack">
          <EmptyState title="Nothing to check yet" actions={<button type="button" className="btn btn-primary" onClick={() => setText(DEMO_TEXT)}>Load demo text</button>}>Paste your text below. At least one full sentence works best.</EmptyState>
          <textarea aria-label="Your text" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><div className="stat-label">Reading ease</div><div className="stat-value" data-testid="ease">{a.readingEase == null ? '—' : Math.round(a.readingEase)}</div><div className="small muted">{easeLabel(a.readingEase)}</div></div>
            <div className="stat"><div className="stat-label">Approx. grade</div><div className="stat-value">{a.grade == null ? '—' : Math.max(1, Math.round(a.grade))}</div><div className="small muted">US school year</div></div>
            <div className="stat"><div className="stat-label">Avg sentence</div><div className="stat-value">{a.avgSentence.toFixed(1)}</div><div className="small muted">words (aim ≤ 20)</div></div>
            <div className="stat"><div className="stat-label">Issues</div><div className="stat-value" data-testid="issues">{a.findings.length}</div><div className="small muted">to review</div></div>
          </div>
          <div className="ed-layout">
            <section className="card" aria-label={mode === 'edit' ? 'Edit text' : 'Highlighted text'}>
              {mode === 'edit' ? (
                <textarea aria-label="Your text" className="ed-text" rows={18} value={text} onChange={(e) => setText(e.target.value)} />
              ) : (
                <Highlighted text={text} findings={a.findings} active={active} hidden={hidden} onPick={setActive} />
              )}
            </section>
            <aside className="card stack" aria-label="Issues">
              <div className="kind-filter" role="group" aria-label="Show issue types">
                {ORDER.map((k) => (
                  <button key={k} type="button" className={`kchip ${KIND[k].cls} ${hidden.has(k) ? 'off' : ''}`} aria-pressed={!hidden.has(k)} onClick={() => toggle(k)}>
                    {KIND[k].label} <strong>{counts[k]}</strong>
                  </button>
                ))}
              </div>
              {plain.length > 1 && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setText(applySuggestions(text, plain)); setFlash({ kind: 'success', text: `Applied ${plain.length} simpler words.` }); }}>Apply all {plain.length} simpler words</button>}
              {a.findings.length === 0 ? (
                <Notice kind="success">No issues found. Short sentences, active voice, everyday words — nice.</Notice>
              ) : list.length === 0 ? (
                <p className="muted">All issue types are hidden.</p>
              ) : (
                <ol className="findings">
                  {list.map(({ f, i }) => (
                    <li key={i} className={`${KIND[f.kind].cls} ${active === i ? 'is-active' : ''}`}>
                      <button type="button" className="f-main" onClick={() => setActive(i)} aria-pressed={active === i}>
                        <span className="label-mono">{KIND[f.kind].label}</span>
                        <span>{f.message}</span>
                      </button>
                      {f.suggestion && <button type="button" className="btn btn-sm" onClick={() => apply(f)} aria-label={`Replace ${f.text} with ${f.suggestion}`}>Use “{f.suggestion}”</button>}
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Guide() {
  return (
    <div className="stack narrow">
      <PageHead eyebrow="Reference" title={<>How ClearText <em>works</em></>} description="Every check is a simple, explainable rule — and every rule has exceptions." />
      <div className="card prose">
        <h2>Sentences</h2>
        <p>Text is split at full stops, question marks and exclamation marks, ignoring common abbreviations (Dr., e.g., i.e.) and decimal numbers. Over 25 words is “long”; over 35 is “very long”.</p>
        <h2>Passive voice</h2>
        <p>A form of “to be” (is, was, were, been…) followed by a past participle (words ending in -ed, or common irregular ones like “made” or “given”). This also catches some adjectives (“she is tired”), so read each one in context.</p>
        <h2>Simpler words</h2>
        <p>A list of formal words and phrases with everyday alternatives (“utilise” → “use”, “in the event that” → “if”). Suggestions keep the original capitalisation.</p>
        <h2>Long words</h2>
        <p>Words of nine or more letters and four or more syllables (estimated). Technical terms may be unavoidable — consider explaining them.</p>
        <h2>Readability scores</h2>
        <p>Flesch reading ease = 206.835 − 1.015 × (words per sentence) − 84.6 × (syllables per word). Higher is easier; 60–70 is roughly plain English. The grade is the Flesch–Kincaid estimate. Syllables are estimated, so treat both as rough indicators for English only.</p>
      </div>
    </div>
  );
}
