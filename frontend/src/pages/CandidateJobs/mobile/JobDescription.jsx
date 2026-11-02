import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import DOMPurify from 'dompurify';
import {
  Check as CheckIcon,
  Remove as DashIcon,
  AutoAwesome as SparkIcon,
  ExpandMore as ChevronIcon,
} from '@mui/icons-material';

/**
 * The posting on a phone, in the same order for every job: quick facts up
 * front, then sticky section tabs over About the role, What you'll do, What
 * they're looking for (each requirement marked from the match), Pay & perks,
 * About <company>, and the fine print folded into one row at the bottom.
 *
 * The shape comes from the API (descriptionStructured, built once per posting
 * by backend/services/jobDescriptionStructure.js). Until it arrives, or for a
 * job that has none, the raw description renders with the same type rules.
 */

const TEXT = '#3b3c50';
const INK = '#1c1b33';
const MUTED = '#5f6075';
const ACCENT = '#5b4bd6';
const MATCHED = '#1db863';
const GAP = '#d0a24a';

// Only benefits the posting actually states. Equity is its own fact.
const BENEFITS = [
  [/\b(health|medical|dental|vision)\s+(insurance|coverage|benefits|plans?)\b/i, 'Health insurance'],
  [/\bunlimited\s+(pto|paid time off|vacation|time off)\b/i, 'Unlimited PTO'],
  [/\b(paid time off|pto|paid vacation)\b/i, 'Paid time off'],
  [/\b401\s?\(?k\)?/i, '401(k)'],
  [/\b(parental|maternity|paternity)\s+leave\b/i, 'Parental leave'],
  [/\b(learning|education|professional development)\s+(stipend|budget|allowance)\b/i, 'Learning budget'],
];

export function benefitsIn(text) {
  return BENEFITS.filter(([re]) => re.test(text)).map(([, label]) => label)
    .filter((l, i, a) => !(l === 'Paid time off' && a.includes('Unlimited PTO')) && a.indexOf(l) === i);
}

// ── Facts ──────────────────────────────────────────────────────────────────

const SYMBOL = { USD: '$', CAD: 'CA$', GBP: '£', EUR: '€', AUD: 'A$' };
const sym = (c) => SYMBOL[c] || '$';
const thousands = (n) => `${Math.round(n / 1000)}k`;

export function salaryChip({ min, max, currency, period }) {
  const s = sym(currency);
  return period === 'hour' ? `${s}${min} – ${s}${max} / hr` : `${s}${thousands(min)} – ${s}${thousands(max)} / yr`;
}

/**
 * Facts read in the browser for a job without a structured description yet:
 * the row's salary columns, else the first plausible range in the text.
 */
export function factsFromJob(job) {
  const text = String(job.description || '').replace(/<[^>]+>/g, ' ');
  const facts = {};
  if (job.salaryMin && job.salaryMax && job.salaryMax >= job.salaryMin) {
    facts.salary = { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency || 'USD', period: /hour/i.test(job.salaryPeriod || '') || job.salaryMax < 500 ? 'hour' : 'year' };
  } else {
    const m = /\$\s?(\d[\d,]*)\s*(k)?\s*(?:USD)?\s*[—–-]\s*\$?\s?(\d[\d,]*)\s*(k)?/i.exec(text);
    if (m) {
      const min = parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
      const max = parseFloat(m[3].replace(/,/g, '')) * (m[4] || m[2] ? 1000 : 1);
      const hourly = max < 500;
      if (max >= min && (hourly ? min >= 7 : min >= 15000 && max <= 2000000)) facts.salary = { min, max, currency: 'USD', period: hourly ? 'hour' : 'year' };
    }
  }
  const exp = /(\d{1,2})\s*(\+)?\s*(?:[-–]\s*(\d{1,2})\s*)?\+?\s*years?\b(?!\s*(?:old|of age|ago))/i.exec(text);
  if (exp && +exp[1] >= 1 && +exp[1] <= 25 && (!exp[3] || +exp[3] > +exp[1])) facts.experience = exp[3] ? `${exp[1]}–${exp[3]} years` : `${exp[1]}+ years`;
  const noDei = text.replace(/\b(diversity,?\s*(and\s*)?equity|equity,?\s*(and\s*)?inclusion|pay equity)\b/gi, '');
  if (/\b(equity|rsus?|stock options?)\b/i.test(noDei)) facts.equity = true;
  return facts;
}

const FactRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;

  span {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    background: #f4f5fa;
    color: ${TEXT};
  }
  .pay { background: #e4f7ec; color: #13804a; }
`;

/** Salary, schedule (or work mode), experience and equity, when stated. */
export function QuickFacts({ facts, showWorkMode }) {
  if (!facts) return null;
  const chips = [];
  if (facts.salary) chips.push(<span key="pay" className="pay">{salaryChip(facts.salary)}</span>);
  if (facts.schedule) chips.push(<span key="sched">{facts.schedule}</span>);
  else if (showWorkMode && facts.workMode) chips.push(<span key="mode">{facts.workMode}</span>);
  if (facts.experience) chips.push(<span key="exp">{facts.experience.replace(/years?/, 'yrs')} experience</span>);
  if (facts.equity) chips.push(<span key="eq">Equity</span>);
  return chips.length ? <FactRow>{chips}</FactRow> : null;
}

// ── Requirement ↔ match ────────────────────────────────────────────────────

const STOP = new Set(['and', 'the', 'with', 'for', 'you', 'your', 'our', 'are', 'have', 'has', 'experience', 'years', 'year', 'strong', 'ability', 'skills', 'knowledge', 'working', 'work', 'including', 'such', 'like', 'that', 'this', 'from', 'into', 'more', 'other', 'equivalent', 'related', 'field', 'proven', 'least', 'plus', 'similar']);
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').split(' ')
  .map((w) => w.replace(/\.$/, '')).filter((w) => w.length >= 2 && !STOP.has(w));

/**
 * Pair each posting bullet with the match requirement it states, one to one,
 * by shared words. A bullet nothing lines up with gets no status.
 */
export function statusesFor(bullets, matchRequirements = []) {
  const reqs = matchRequirements.map((r) => ({ r, w: new Set(words(r.requirement)) }));
  const pairs = [];
  bullets.forEach((b, bi) => {
    const bw = new Set(words(b));
    reqs.forEach(({ w }, ri) => {
      if (!w.size || !bw.size) return;
      let shared = 0;
      w.forEach((x) => { if (bw.has(x)) shared += 1; });
      const score = shared / Math.min(w.size, bw.size);
      if (shared >= 1 && score >= 0.5) pairs.push({ bi, ri, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  const out = new Array(bullets.length).fill(null);
  const used = new Set();
  for (const { bi, ri } of pairs) {
    if (out[bi] || used.has(ri)) continue;
    out[bi] = reqs[ri].r.status;
    used.add(ri);
  }
  return out;
}

// ── Remembered open/closed state, per job, for Back → Job ──────────────────

function useOpenState(jobId) {
  const key = `jd-open:${jobId}`;
  const read = () => {
    try { return JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; }
  };
  const [open, setOpen] = useState(read);
  useEffect(() => { setOpen(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (name) => setOpen((prev) => {
    const next = { ...prev, [name]: !prev[name] };
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch (_) { /* private mode */ }
    return next;
  });
  return [open, toggle];
}

// ── Styles ─────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  max-width: 68ch;
  color: ${TEXT};

  p { margin: 0 0 12px; font-size: 15px; line-height: 1.6; text-wrap: pretty; overflow-wrap: anywhere; }
  h2 { margin: 28px 0 10px; font-size: 17px; font-weight: 700; color: ${INK}; line-height: 1.3; }
  h3 { margin: 16px 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: ${MUTED}; }
  section { scroll-margin-top: 52px; }
  a { color: ${ACCENT}; font-weight: 600; text-decoration: none; }
  a:hover, a:focus-visible { text-decoration: underline; }

  .list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .list li { display: flex; gap: 12px; font-size: 15px; line-height: 1.55; text-wrap: pretty; overflow-wrap: anywhere; }
  .dot { flex-shrink: 0; width: 6px; height: 6px; margin-top: 9px; border-radius: 50%; background: ${ACCENT}; }
  .mark { flex-shrink: 0; width: 22px; height: 22px; margin-top: 1px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }
  .mark svg { font-size: 15px; }
  .list.marked li { gap: 10px; }
  .list.marked .dot { margin: 9px 8px 0; }
  .partly { color: #8a8ba0; font-size: 13px; }

  .more {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: ${ACCENT};
    cursor: pointer;
  }
  .gaps {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    margin-top: 14px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid #dcd6fa;
    background: #f1effe;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: ${ACCENT};
    cursor: pointer;
    svg { font-size: 16px; }
  }

  .pay {
    padding: 14px;
    border-radius: 14px;
    background: #f6f7fb;
    border: 1px solid #e6e7f0;
  }
  .pay .range { font-size: 20px; font-weight: 800; color: ${INK}; line-height: 1.25; }
  .pay .unit { margin-top: 2px; font-size: 12px; color: ${MUTED}; }
  .pay .sched { margin-top: 10px; font-size: 14px; color: ${TEXT}; }
  .pay .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .pay .chips span { height: 28px; display: inline-flex; align-items: center; padding: 0 10px; border-radius: 8px; font-size: 12px; font-weight: 600; background: #e8f0ff; color: #2457c5; }
  .pay .chips .eq { background: #e4f7ec; color: #13804a; }
  .pay + .list { margin-top: 14px; }

  .legal { margin-top: 28px; border-top: 1px solid #e6e7f0; border-bottom: 1px solid #e6e7f0; }
  .legal > button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: ${INK};
    text-align: left;
    cursor: pointer;
  }
  .legal > button svg { flex-shrink: 0; color: #8a8ba0; transition: transform .2s; }
  .legal > button[aria-expanded='true'] svg { transform: rotate(180deg); }
  .legal .fine { padding-bottom: 12px; }
  .legal .fine p { font-size: 13px; line-height: 1.55; color: ${MUTED}; }
  .legal .links { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; }
  .legal .links a { display: inline-flex; align-items: center; min-height: 44px; }

  /* Raw description, when there is no structure yet. */
  .raw ul, .raw ol { margin: 0 0 12px; padding-left: 20px; }
  .raw li { margin-bottom: 10px; font-size: 15px; line-height: 1.55; text-wrap: pretty; }
  .raw li::marker { color: ${ACCENT}; }
  .raw strong, .raw b { color: ${INK}; }
  .raw img, .raw table { max-width: 100%; }
  .raw h2:first-child { margin-top: 0; }
`;

// top: the scroll body's 18px top padding insets where sticky sticks; pull
// back by it so the bar meets the header with no content showing between.
const Tabs = styled.div`
  position: sticky;
  top: -18px;
  z-index: 2;
  margin: 24px -16px 0;
  background: #fff;
  border-bottom: 1px solid #eceef4;

  .row {
    display: flex;
    gap: 16px;
    padding: 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
  &.overflow::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 1px;
    width: 32px;
    pointer-events: none;
    background: linear-gradient(to right, rgba(255, 255, 255, 0), #fff);
  }
  button {
    flex-shrink: 0;
    height: 44px;
    padding: 0;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #8a8ba0;
    white-space: nowrap;
    cursor: pointer;
  }
  button[aria-selected='true'] { color: ${INK}; border-bottom-color: ${ACCENT}; }
`;

// ── Pieces ─────────────────────────────────────────────────────────────────

const Bullets = ({ items }) => (
  <ul className="list">
    {items.map((t, i) => <li key={i}><span className="dot" aria-hidden="true" /><span>{t}</span></li>)}
  </ul>
);

function MarkedList({ items, statuses }) {
  const marked = statuses.some(Boolean);
  return (
    <ul className={`list${marked ? ' marked' : ''}`}>
      {items.map((t, i) => {
        const st = statuses[i];
        return (
          <li key={i}>
            {st ? (
              <span className="mark" style={{ background: st === 'met' ? MATCHED : st === 'partial' ? '#8fcfa7' : GAP }} role="img" aria-label={st === 'missing' ? 'Gap' : st === 'partial' ? 'Partly matched' : 'Matched'}>
                {st === 'missing' ? <DashIcon /> : <CheckIcon />}
              </span>
            ) : <span className="dot" aria-hidden="true" />}
            <span>{t}{st === 'partial' && <span className="partly"> · partly</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Sanitized raw description: short bold lines become section titles. */
function rawHtml(html) {
  const clean = DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href'],
  });
  if (typeof DOMParser === 'undefined') return clean;
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll('h1, h3, h4, h5, h6').forEach((h) => { const h2 = doc.createElement('h2'); h2.textContent = h.textContent; h.replaceWith(h2); });
  root.querySelectorAll('p').forEach((p) => {
    const t = p.textContent.trim();
    const onlyBold = p.children.length === 1 && /^(STRONG|B)$/.test(p.children[0].tagName) && p.children[0].textContent.trim() === t;
    if (!t) p.remove();
    else if (onlyBold && t.length < 60 && !/[.!?]$/.test(t)) { const h2 = doc.createElement('h2'); h2.textContent = t.replace(/:$/, ''); p.replaceWith(h2); }
  });
  root.querySelectorAll('a').forEach((a) => {
    if (/^https?:/i.test(a.getAttribute('href') || '')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
  });
  return root.innerHTML;
}

// ── The description ────────────────────────────────────────────────────────

export default function JobDescription({
  job, structured, descriptionHtml, match, scrollRef, canTailor, onTailor, listRef,
}) {
  const [open, toggle] = useOpenState(job.id);
  const [active, setActive] = useState(null);
  const [overflow, setOverflow] = useState(false);
  const tabsRef = useRef(null);
  const rowRef = useRef(null);
  const refs = useRef({});

  const s = structured;
  const sections = s?.sections || [];
  const bySection = (k) => sections.find((x) => x.kind === k);
  const team = bySection('team');
  const resp = bySection('responsibilities');
  const req = bySection('requirements');
  const nice = bySection('niceToHave');
  const benefitsSection = bySection('benefits');
  const others = sections.filter((x) => x.kind === 'other');
  const facts = s?.facts || {};

  const descText = `${job.description || ''} ${job.requirements || ''}`;
  const benefits = useMemo(() => benefitsIn(descText), [descText]);
  const companyName = job.company || 'the company';
  const companyParas = s?.company?.paragraphs || [];
  const legal = s?.legal || { paragraphs: [], links: [] };
  const hasPay = !!(facts.salary || facts.scheduleDetail || facts.equity || benefits.length || benefitsSection);

  const matchReqs = match?.requirements || [];
  // One pairing across both lists, so a match requirement marks one bullet.
  const [reqStatuses, niceStatuses] = useMemo(() => {
    const reqItems = req?.items || [];
    const all = statusesFor([...reqItems, ...(nice?.items || [])], matchReqs);
    return [all.slice(0, reqItems.length), all.slice(reqItems.length)];
  }, [req, nice, matchReqs]);
  const gaps = [...reqStatuses, ...niceStatuses].filter((x) => x === 'missing').length;

  const tabs = [
    (s?.summary || team) && ['overview', 'Overview'],
    resp && ['resp', "You'll do"],
    (req || nice) && ['req', 'You have'],
    hasPay && ['pay', 'Pay & perks'],
    companyParas.length > 0 && ['company', 'Company'],
  ].filter(Boolean);
  const tabKey = tabs.map((t) => t[0]).join(',');

  // The tab for the section under the tab bar: the last one whose top has
  // passed it, or the last tab once the page can't scroll further. (An
  // IntersectionObserver band picked the earlier of two sections sharing
  // the screen, so Company never lit up at the bottom.)
  useEffect(() => {
    const root = scrollRef?.current;
    if (!root || !tabs.length) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = root.getBoundingClientRect().top + (tabsRef.current?.offsetHeight || 44) + 24;
      let current = tabs[0][0];
      for (const [k] of tabs) {
        const el = refs.current[k];
        if (el && el.getBoundingClientRect().top <= line) current = k;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = tabs[tabs.length - 1][0];
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { root.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [tabKey, scrollRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the lit tab in view in its own row ("Company" starts off the edge).
  useEffect(() => {
    const row = rowRef.current;
    const btn = row && active && row.querySelector(`[data-key="${active}"]`);
    if (!btn) return;
    if (btn.offsetLeft < row.scrollLeft || btn.offsetLeft + btn.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: btn.offsetLeft - 16, behavior: 'smooth' });
    }
  }, [active]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const check = () => setOverflow(row.scrollWidth - row.scrollLeft - row.clientWidth > 2);
    check();
    row.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { row.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [tabKey]);

  const goTo = (key) => {
    const root = scrollRef?.current;
    const el = refs.current[key];
    if (!root || !el) return;
    setActive(key);
    const offset = (tabsRef.current?.offsetHeight || 44) + 8;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset;
    root.scrollTo({ top, behavior: 'smooth' });
  };
  if (listRef) listRef.current = () => goTo('req');

  const sectionRef = (k) => (el) => { refs.current[k] = el; };

  if (!s) {
    if (!descriptionHtml) return null;
    return (
      <Wrap>
        <h2>About the role</h2>
        <div className="raw" dangerouslySetInnerHTML={{ __html: rawHtml(descriptionHtml) }} />
      </Wrap>
    );
  }

  const teamParas = team?.paragraphs || [];
  const respItems = resp?.items || [];
  const respParas = resp?.paragraphs || [];

  return (
    <Wrap>
      {tabs.length > 1 && (
        <Tabs ref={tabsRef} className={overflow ? 'overflow' : ''}>
          <div className="row" ref={rowRef} role="tablist" aria-label="Job sections">
            {tabs.map(([k, label]) => (
              <button key={k} data-key={k} type="button" role="tab" aria-selected={(active || tabs[0][0]) === k} onClick={() => goTo(k)}>{label}</button>
            ))}
          </div>
        </Tabs>
      )}

      {(s.summary || teamParas.length > 0) && (
        <section ref={sectionRef('overview')} data-tab="overview">
          <h2>About the role</h2>
          {s.summary && <p>{s.summary}</p>}
          {(open.team ? teamParas : teamParas.slice(0, 2)).map((p, i) => <p key={i}>{p}</p>)}
          {team?.items && <Bullets items={team.items} />}
          {teamParas.length > 2 && (
            <button type="button" className="more" aria-expanded={!!open.team} onClick={() => toggle('team')}>{open.team ? 'Show less' : 'Read more'}</button>
          )}
        </section>
      )}

      {resp && (
        <section ref={sectionRef('resp')} data-tab="resp">
          <h2>What you&apos;ll do</h2>
          {respParas.map((p, i) => <p key={i}>{p}</p>)}
          {respItems.length > 0 && <Bullets items={open.resp ? respItems : respItems.slice(0, 5)} />}
          {respItems.length > 5 && (
            <button type="button" className="more" aria-expanded={!!open.resp} onClick={() => toggle('resp')}>{open.resp ? 'Show fewer' : `Show all ${respItems.length}`}</button>
          )}
        </section>
      )}

      {(req || nice) && (
        <section ref={sectionRef('req')} data-tab="req">
          <h2>What they&apos;re looking for</h2>
          {(req?.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
          {req?.items && <MarkedList items={req.items} statuses={reqStatuses} />}
          {nice && (
            <>
              <h3>Nice to have</h3>
              {(nice.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
              {nice.items && <MarkedList items={nice.items} statuses={niceStatuses} />}
            </>
          )}
          {canTailor && gaps > 0 && (
            <button type="button" className="gaps" onClick={onTailor}><SparkIcon />{gaps === 1 ? 'Tailor resume for the gap' : 'Tailor resume for the gaps'}</button>
          )}
        </section>
      )}

      {others.map((o) => (
        <section key={o.title}>
          <h2>{o.title}</h2>
          {(o.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
          {o.items && <Bullets items={o.items} />}
        </section>
      ))}

      {hasPay && (
        <section ref={sectionRef('pay')} data-tab="pay">
          <h2>Pay &amp; perks</h2>
          {(facts.salary || facts.scheduleDetail || facts.equity || benefits.length > 0) && (
            <div className="pay">
              {facts.salary && (
                <>
                  <div className="range">
                    {facts.salary.period === 'hour'
                      ? `${sym(facts.salary.currency)}${facts.salary.min} – ${sym(facts.salary.currency)}${facts.salary.max}`
                      : `${sym(facts.salary.currency)}${facts.salary.min.toLocaleString('en-US')} – ${sym(facts.salary.currency)}${facts.salary.max.toLocaleString('en-US')}`}
                  </div>
                  <div className="unit">{facts.salary.currency} {facts.salary.period === 'hour' ? 'per hour' : 'per year'} · base salary</div>
                </>
              )}
              {facts.scheduleDetail && <div className="sched">{facts.scheduleDetail}</div>}
              {(facts.equity || benefits.length > 0) && (
                <div className="chips">
                  {facts.equity && <span className="eq">Equity</span>}
                  {benefits.map((b) => <span key={b}>{b}</span>)}
                </div>
              )}
            </div>
          )}
          {benefitsSection && (
            <>
              {(benefitsSection.paragraphs || []).slice(0, open.benefits ? undefined : 1).map((p, i) => <p key={i} style={{ marginTop: 14 }}>{p}</p>)}
              {benefitsSection.items && <Bullets items={open.benefits ? benefitsSection.items : benefitsSection.items.slice(0, 5)} />}
              {((benefitsSection.items || []).length > 5 || (benefitsSection.paragraphs || []).length > 1) && (
                <button type="button" className="more" aria-expanded={!!open.benefits} onClick={() => toggle('benefits')}>{open.benefits ? 'Show fewer' : 'Show all benefits'}</button>
              )}
            </>
          )}
        </section>
      )}

      {companyParas.length > 0 && (
        <section ref={sectionRef('company')} data-tab="company">
          <h2>About {companyName}</h2>
          {(open.company ? companyParas : companyParas.slice(0, 1)).map((p, i) => <p key={i}>{p}</p>)}
          {companyParas.length > 1 && (
            <button type="button" className="more" aria-expanded={!!open.company} onClick={() => toggle('company')}>{open.company ? 'Show less' : 'Read more'}</button>
          )}
        </section>
      )}

      {legal.paragraphs.length > 0 && (
        <div className="legal">
          <button type="button" aria-expanded={!!open.legal} aria-controls={`jd-legal-${job.id}`} onClick={() => toggle('legal')}>
            Pay details, EEO &amp; accommodations <ChevronIcon />
          </button>
          <div className="fine" id={`jd-legal-${job.id}`} hidden={!open.legal}>
            {legal.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            {legal.links.length > 0 && (
              <div className="links">
                {legal.links.map((l) => (
                  <a key={l.href} href={l.href} {...(/^https?:/i.test(l.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Wrap>
  );
}
