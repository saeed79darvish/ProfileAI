/* ApplyPilot v2 · the choices a user makes in Setup and later edits in
   Settings. One hook owns loading, profile prefill, the PUT /config
   payload and the live match count, so both screens save identically.

   Only fields the backend actually stores are offered. The old wizard's
   schedule, deal-breaker keywords, "skip jobs without pay" and education
   pickers were never saved, so they are gone; education is shown from
   the profile because that is what the form filler reads. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { profileAPI, applyPilotAPI } from '../../../services/api';
import { useApplyPilotConfig, saveApplyPilotConfig } from '../../../hooks/useApplyPilot';
import { T, Row, Col, Card, H2, Muted, Pill, Field, Input, Btn, Chip } from './ui';

export const LEVELS = ['Junior', 'Mid', 'Senior', 'Staff+', 'Principal', 'Lead / EM'];
export const INDUSTRIES = ['Fintech', 'Infrastructure', 'Dev tools', 'AI / ML', 'Healthcare', 'E-commerce', 'Gaming', 'Media'];
export const WORKSTYLES = [
  { key: 'Remote', sub: 'Work from home' },
  { key: 'Hybrid', sub: 'Some days in the office' },
  { key: 'On-site', sub: 'In the office every day' },
];
export const SIZES = ['Seed · 1–50', 'Growth · 51–500', 'Scale · 501–5k', 'Enterprise · 5k+'];
export const AUTH = [
  { key: 'citizen', label: 'Citizen or permanent resident' },
  { key: 'visa', label: 'On a work visa' },
  { key: 'need', label: 'I need sponsorship' },
];
export const RELOCATE = [{ key: 'yes', label: 'Yes' }, { key: 'depends', label: 'Depends on the job' }, { key: 'no', label: 'No' }];
export const NOTICE = ['Immediate', '2 weeks', '4 weeks', '6+ weeks'];
const GENDER = ['Male', 'Female', 'Non-binary', 'Prefer to self-describe', 'Decline to answer'];
const ETHNICITY = ['Hispanic or Latino', 'White', 'Black or African American', 'Asian', 'Native Hawaiian or Other Pacific Islander', 'American Indian or Alaska Native', 'Two or More Races'];
const VETERAN = [{ key: 'protected', label: 'Protected veteran' }, { key: 'not_protected', label: 'Not a protected veteran' }, { key: 'decline', label: 'Prefer not to say' }];
const DISABILITY = [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }, { key: 'decline', label: 'Prefer not to say' }];

export const PACES = [
  { n: 5, label: 'Light', sub: 'About 10 minutes a day' },
  { n: 15, label: 'Steady', sub: 'Most people pick this' },
  { n: 30, label: 'Active', sub: 'For an urgent search' },
];
export const FITS = [
  { key: 'strong', threshold: 75, label: 'Strong matches only', sub: 'Strong means 75% or higher. Fewer jobs, each a close fit.' },
  { key: 'good', threshold: 65, label: 'Strong and good matches', sub: 'Good means 65% to 74%. The best balance for most people.' },
  { key: 'wide', threshold: 50, label: 'Cast a wide net', sub: 'Adds stretch jobs, 50% to 64%. More jobs, some a reach.' },
];
const fitFromThreshold = (t) => (t >= 75 ? 'strong' : t >= 65 ? 'good' : 'wide');

const blank = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v.filter((x) => String(x || '').trim()) : []);

function hydrate(cfg, profile) {
  const c = cfg?.config?.criteria || {};
  const d = cfg?.config?.demographics || {};
  const p = cfg?.config?.profile || {};
  const r = cfg?.config?.rails || {};
  const fresh = !arr(c.roleTitles).length;
  const daily = Number(c.dailyLimit) || 15;
  return {
    roleTitles: arr(c.roleTitles).length ? arr(c.roleTitles) : (blank(profile?.title) ? [profile.title.trim()] : []),
    seniority: arr(c.seniority),
    industries: arr(c.industries),
    workstyle: arr(c.workstyle).length ? arr(c.workstyle) : ['Remote', 'Hybrid'],
    locations: arr(c.locations).length ? arr(c.locations) : (blank(profile?.location) ? [profile.location.trim()] : []),
    salaryFloorK: Number(c.salaryFloorK) || 150,
    companySize: arr(c.companySize),
    dailyLimit: Math.max(5, Math.min(60, daily)),
    fit: fitFromThreshold(Number(c.matchThreshold) || 65),
    allowFederal: !!c.allowFederal,
    blockedCompanies: arr(r.blockedCompanies),
    workAuthorization: d.workAuthorization || null,
    genderIdentity: d.genderIdentity || null,
    ethnicity: Array.isArray(d.ethnicity) ? d.ethnicity : [],
    veteran: d.veteran || null,
    disability: d.disability || null,
    phone: p.phone || profile?.phone || '',
    linkedinUrl: p.linkedinUrl || profile?.linkedinUrl || profile?.linkedin || '',
    githubUrl: p.githubUrl || profile?.githubUrl || '',
    portfolioUrl: p.portfolioUrl || profile?.portfolioUrl || profile?.website || '',
    noticePeriod: p.noticePeriod || '2 weeks',
    salaryExpectation: p.salaryExpectation || '',
    relocate: p.relocationWillingness === true ? 'yes' : p.relocationWillingness === false ? 'no' : 'depends',
    fresh,
  };
}

export function buildPayload(s) {
  const fit = FITS.find((f) => f.key === s.fit) || FITS[1];
  return {
    criteria: {
      roleTitles: arr(s.roleTitles),
      seniority: arr(s.seniority),
      industries: arr(s.industries),
      workstyle: arr(s.workstyle),
      locations: arr(s.locations),
      salaryFloorK: Number(s.salaryFloorK) || 0,
      companySize: arr(s.companySize),
      dailyLimit: Math.max(5, Math.min(60, Number(s.dailyLimit) || 15)),
      matchThreshold: fit.threshold,
      allowFederal: !!s.allowFederal,
    },
    demographics: {
      workAuthorization: s.workAuthorization || null,
      genderIdentity: s.genderIdentity || null,
      ethnicity: s.ethnicity?.length ? s.ethnicity : null,
      veteran: s.veteran || null,
      disability: s.disability || null,
    },
    profile: {
      phone: blank(s.phone),
      linkedinUrl: blank(s.linkedinUrl),
      githubUrl: blank(s.githubUrl),
      portfolioUrl: blank(s.portfolioUrl),
      noticePeriod: blank(s.noticePeriod),
      salaryExpectation: blank(s.salaryExpectation),
      relocationWillingness: s.relocate === 'yes' ? true : s.relocate === 'no' ? false : null,
    },
    rails: { blockedCompanies: arr(s.blockedCompanies) },
  };
}

/* autosave: true in Settings (debounced), false in Setup (saved on Start). */
export function useCriteria({ autosave = false } = {}) {
  const { data: cfg, loading: cfgLoading, refetch } = useApplyPilotConfig();
  const [profile, setProfile] = useState(undefined);
  const [s, setS] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [match, setMatch] = useState(null);
  const touched = useRef(false);

  useEffect(() => {
    let off = false;
    profileAPI.getMyProfile().then((r) => { if (!off) setProfile(r?.data || null); }).catch(() => { if (!off) setProfile(null); });
    return () => { off = true; };
  }, []);

  useEffect(() => {
    if (s || cfgLoading || profile === undefined) return;
    setS(hydrate(cfg, profile));
  }, [cfg, cfgLoading, profile, s]);

  // `pending` is true from the first keystroke until that version is
  // saved. Leaving the page inside the debounce window used to drop the
  // change (a phone number typed in Settings never reached the server),
  // so a pending change is flushed on unmount and before the tab closes.
  const pending = useRef(false);
  const latest = useRef(null);
  useEffect(() => { latest.current = s; }, [s]);

  const set = useCallback((patch) => {
    touched.current = true;
    pending.current = true;
    setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
    setSaveState('pending');
  }, []);

  const save = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot) return null;
    setSaveState('saving');
    try {
      const res = await saveApplyPilotConfig(buildPayload(snapshot));
      if (latest.current === snapshot) pending.current = false;
      setSaveState('saved');
      return res;
    } catch (e) {
      setSaveState('error');
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!autosave || !s || !touched.current) return undefined;
    const id = setTimeout(() => { save().catch(() => {}); }, 700);
    return () => clearTimeout(id);
  }, [autosave, s, save]);

  useEffect(() => {
    if (!autosave) return undefined;
    const flush = () => {
      if (pending.current && latest.current) {
        pending.current = false;
        saveApplyPilotConfig(buildPayload(latest.current)).catch(() => {});
      }
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [autosave]);

  const matchKey = s ? JSON.stringify([s.roleTitles, s.seniority, s.industries, s.workstyle, s.locations, s.salaryFloorK, s.allowFederal]) : '';
  useEffect(() => {
    if (!s) return undefined;
    let off = false;
    const id = setTimeout(async () => {
      try {
        const res = await applyPilotAPI.matchPreview({
          roleTitles: s.roleTitles, seniority: s.seniority, industries: s.industries,
          workstyle: s.workstyle.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')),
          locations: s.locations, salaryFloorK: s.salaryFloorK, allowFederal: s.allowFederal,
        });
        if (!off) setMatch(res?.data || null);
      } catch { if (!off) setMatch(null); }
    }, 400);
    return () => { off = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  return { s, set, save, saveState, match, profile, cfg, refetch, ready: !!s };
}

/* ── small inputs ─────────────────────────────────────────────── */

const ChipBox = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  min-height: 52px; padding: 8px 12px; box-sizing: border-box;
  border: 1px solid ${T.lineStrong}; border-radius: 12px; background: #fff;
  &:focus-within { border-color: ${T.brand}; box-shadow: 0 0 0 3px #e3dffc; }
  input { flex: 1 1 160px; border: 0; outline: none; font: inherit; font-size: 15px; min-height: 34px; background: transparent; }
`;
const Tag = styled.span`
  display: inline-flex; align-items: center; gap: 4px; padding: 6px 6px 6px 12px;
  border-radius: 50px; background: ${T.tint2}; color: ${T.brandInk}; font-size: 14px; font-weight: 600;
  button { width: 26px; height: 26px; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; font-size: 16px; line-height: 1; }
  button:hover { background: #dcd6fb; }
`;

export function TagInput({ id, values, onChange, placeholder, suggestions = [] }) {
  const [text, setText] = useState('');
  const add = (v) => {
    const t = String(v || '').trim();
    if (!t) return;
    if (!values.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setText('');
  };
  const left = suggestions.filter((x) => !values.some((v) => v.toLowerCase() === x.toLowerCase())).slice(0, 4);
  return (
    <Col $gap={8}>
      <ChipBox>
        {values.map((v) => (
          <Tag key={v}>{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button></Tag>
        ))}
        <input
          id={id}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={() => add(text)}
        />
      </ChipBox>
      {left.length > 0 && (
        <Row $gap={8} style={{ fontSize: 14, color: T.ink2 }}>
          Suggestions:
          {left.map((x) => (
            <Btn key={x} $size="sm" onClick={() => add(x)} style={{ borderStyle: 'dashed', borderRadius: 50, color: T.brandInk }}>+ {x}</Btn>
          ))}
        </Row>
      )}
    </Col>
  );
}

function Toggles({ options, values, onChange, label }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      {label && <legend style={{ fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 10 }}>{label}</legend>}
      <Row $gap={8}>
        {options.map((o) => {
          const key = typeof o === 'string' ? o : o.key;
          const text = typeof o === 'string' ? o : o.label;
          const on = values.includes(key);
          return <Pill key={key} $on={on} aria-pressed={on} onClick={() => onChange(on ? values.filter((v) => v !== key) : [...values, key])}>{text}</Pill>;
        })}
      </Row>
    </fieldset>
  );
}

function OneOf({ options, value, onChange, label }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      {label && <legend style={{ fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 10 }}>{label}</legend>}
      <Row $gap={8}>
        {options.map((o) => {
          const key = typeof o === 'string' ? o : o.key;
          const text = typeof o === 'string' ? o : o.label;
          return <Pill key={key} $on={value === key} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</Pill>;
        })}
      </Row>
    </fieldset>
  );
}

const ChoiceCard = styled.button.attrs({ type: 'button' })`
  display: flex; flex-direction: ${(p) => (p.$row ? 'row' : 'column')}; align-items: ${(p) => (p.$row ? 'center' : 'flex-start')};
  gap: ${(p) => (p.$row ? 14 : 4)}px; text-align: left; padding: 16px; border-radius: 14px; cursor: pointer;
  font: inherit; color: ${T.ink};
  ${(p) => (p.$on ? `border: 2px solid ${T.brand}; background: ${T.tint};` : `border: 1px solid ${T.lineStrong}; background: #fff;`)}
  &:focus-visible { outline: 3px solid #b9b0f5; outline-offset: 2px; }
`;
const Radio = styled.span`
  width: 20px; height: 20px; flex: none; border-radius: 50%; box-sizing: border-box;
  border: ${(p) => (p.$on ? `6px solid ${T.brand}` : '2px solid #9a98ad')};
`;
const Grid = styled.div`
  display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(${(p) => p.$min || 170}px, 1fr));
`;
const More = styled.details`
  border: 1px solid ${T.line}; border-radius: 14px; background: #fff; padding: 16px 20px;
  summary { font-size: 15px; font-weight: 700; cursor: pointer; }
`;

/* ── sections (titles shared by Setup steps and Settings) ─────── */

export const SECTIONS = [
  { key: 'jobs', title: 'Jobs you want' },
  { key: 'where', title: 'Where and pay' },
  { key: 'answers', title: 'Your answers' },
  { key: 'pace', title: 'How many, how picky' },
];

export function JobsSection({ c }) {
  const { s, set, profile } = c;
  const suggestions = useMemo(() => {
    const t = String(profile?.title || '').toLowerCase();
    if (/front|ui|react|web/.test(t)) return ['Senior Frontend Engineer', 'Frontend Engineer', 'UI Engineer', 'Full Stack Engineer', 'React Engineer'];
    if (/back|platform|infra|devops|sre/.test(t)) return ['Backend Engineer', 'Platform Engineer', 'Senior Software Engineer', 'Site Reliability Engineer'];
    if (/data|ml|machine|ai/.test(t)) return ['Data Engineer', 'Machine Learning Engineer', 'Data Scientist', 'Analytics Engineer'];
    if (/product manager|pm/.test(t)) return ['Product Manager', 'Senior Product Manager', 'Technical Product Manager'];
    return ['Software Engineer', 'Senior Software Engineer', 'Full Stack Engineer'];
  }, [profile]);
  return (
    <Col $gap={22}>
      <Field as="div">
        <label htmlFor="ap-titles">Job titles</label>
        <TagInput id="ap-titles" values={s.roleTitles} onChange={(v) => set({ roleTitles: v })} placeholder="Type a title and press Enter" suggestions={suggestions} />
        <Muted $size={13}>Similar titles count too, so "Frontend Engineer" also finds "UI Engineer".</Muted>
      </Field>
      <Toggles label="Level" options={LEVELS} values={s.seniority} onChange={(v) => set({ seniority: v })} />
      <More>
        <summary>Industries (optional)</summary>
        <div style={{ paddingTop: 14 }}><Toggles options={INDUSTRIES} values={s.industries} onChange={(v) => set({ industries: v })} /></div>
      </More>
    </Col>
  );
}

export function WhereSection({ c }) {
  const { s, set } = c;
  return (
    <Col $gap={22}>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 10 }}>How you want to work (pick at least one)</legend>
        <Grid>
          {WORKSTYLES.map((w) => {
            const on = s.workstyle.includes(w.key);
            return (
              <ChoiceCard key={w.key} $on={on} aria-pressed={on} onClick={() => {
                const next = on ? s.workstyle.filter((x) => x !== w.key) : [...s.workstyle, w.key];
                if (next.length) set({ workstyle: next });
              }}>
                <strong>{w.key}</strong><span style={{ fontSize: 13, color: T.ink2 }}>{w.sub}</span>
              </ChoiceCard>
            );
          })}
        </Grid>
      </fieldset>
      <Field as="div">
        <label htmlFor="ap-locs">Cities or areas</label>
        <TagInput id="ap-locs" values={s.locations} onChange={(v) => set({ locations: v })} placeholder="Type a city and press Enter" />
      </Field>
      <Card $gap={10}>
        <Row $justify="space-between" $align="baseline">
          <label htmlFor="ap-salary" style={{ fontSize: 15, fontWeight: 700 }}>Lowest base salary you'd take</label>
          <span style={{ fontSize: 22, fontWeight: 800 }}>${s.salaryFloorK}k a year</span>
        </Row>
        <input id="ap-salary" type="range" min="50" max="300" step="5" value={s.salaryFloorK}
          onChange={(e) => set({ salaryFloorK: Number(e.target.value) })} style={{ width: '100%', accentColor: T.brand }} />
        <Muted $size={13}>Jobs that don't list pay are still included.</Muted>
      </Card>
      <More>
        <summary>Company size (optional)</summary>
        <div style={{ paddingTop: 14 }}><Toggles options={SIZES} values={s.companySize} onChange={(v) => set({ companySize: v })} /></div>
      </More>
    </Col>
  );
}

export function AnswersSection({ c, showMissing }) {
  const { s, set, profile } = c;
  const edu = Array.isArray(profile?.education) ? profile.education.filter(Boolean) : [];
  const top = edu[0];
  const eduText = top ? [top.degree, top.field || top.fieldOfStudy].filter(Boolean).join(' in ') + (top.institution || top.school ? `, ${top.institution || top.school}` : '') : null;
  return (
    <Col $gap={18}>
      <Card $gap={12} style={showMissing && !s.workAuthorization ? { borderColor: T.warnLine, background: T.warnSoft } : undefined}>
        <OneOf label="Can you work in the United States?" options={AUTH} value={s.workAuthorization} onChange={(v) => set({ workAuthorization: v })} />
        {showMissing && !s.workAuthorization && <Muted $size={13} style={{ color: T.warn }}>Pick one to continue. Almost every application asks this.</Muted>}
      </Card>
      <Card><OneOf label="Would you move for a job?" options={RELOCATE} value={s.relocate} onChange={(v) => set({ relocate: v })} /></Card>
      <Card><OneOf label="How soon could you start?" options={NOTICE} value={s.noticePeriod} onChange={(v) => set({ noticePeriod: v })} /></Card>
      <Card $gap={8}>
        <label htmlFor="ap-salexp" style={{ fontSize: 15, fontWeight: 700 }}>Salary you'd ask for</label>
        <Muted $size={13}>Many forms ask this. If you leave it blank we use your lowest salary ({`$${s.salaryFloorK}k`}).</Muted>
        <Input id="ap-salexp" value={s.salaryExpectation} onChange={(e) => set({ salaryExpectation: e.target.value })} placeholder={`For example $${s.salaryFloorK + 20},000`} style={{ maxWidth: 320 }} />
      </Card>
      <Card $gap={14}>
        <Row $justify="space-between"><strong>Contact and links</strong><Muted $size={13}>From your profile</Muted></Row>
        <Grid $min={240}>
          <Field>Phone (most applications require it)<Input type="tel" value={s.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(415) 555-0134" style={showMissing && !String(s.phone || '').trim() ? { borderColor: T.warnLine, background: T.warnSoft } : undefined} /></Field>
          <Field>LinkedIn<Input type="url" value={s.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value })} placeholder="linkedin.com/in/your-name" /></Field>
          <Field>GitHub (optional)<Input type="url" value={s.githubUrl} onChange={(e) => set({ githubUrl: e.target.value })} placeholder="github.com/your-name" /></Field>
          <Field>Portfolio (optional)<Input type="url" value={s.portfolioUrl} onChange={(e) => set({ portfolioUrl: e.target.value })} placeholder="your-site.com" /></Field>
        </Grid>
      </Card>
      <Card $gap={8}>
        <Row $justify="space-between">
          <strong>Education</strong>
          <a href="/profile" style={{ fontSize: 14, fontWeight: 700 }}>Change in your profile</a>
        </Row>
        <Muted>{eduText || 'Not on your profile yet. Add it there so degree questions can be answered.'}</Muted>
      </Card>
      <More>
        <summary>Diversity questions (optional)</summary>
        <Col $gap={16} style={{ paddingTop: 14 }}>
          <Muted $size={14}>Voluntary and never used in hiring decisions. Anything you leave blank is answered "prefer not to say".</Muted>
          <OneOf label="Gender" options={GENDER} value={s.genderIdentity} onChange={(v) => set({ genderIdentity: v })} />
          <Toggles label="Race or ethnicity (pick any)" options={ETHNICITY} values={s.ethnicity} onChange={(v) => set({ ethnicity: v })} />
          <OneOf label="Veteran status" options={VETERAN} value={s.veteran} onChange={(v) => set({ veteran: v })} />
          <OneOf label="Disability" options={DISABILITY} value={s.disability} onChange={(v) => set({ disability: v })} />
        </Col>
      </More>
    </Col>
  );
}

export function PaceSection({ c }) {
  const { s, set } = c;
  const isPreset = PACES.some((p) => p.n === s.dailyLimit);
  const [custom, setCustom] = useState(!isPreset);
  return (
    <Col $gap={22}>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 10 }}>Applications to get ready each day</legend>
        <Grid $min={150}>
          {PACES.map((p) => {
            const on = !custom && s.dailyLimit === p.n;
            return (
              <ChoiceCard key={p.n} $on={on} aria-pressed={on} onClick={() => { setCustom(false); set({ dailyLimit: p.n }); }}>
                <span style={{ fontSize: 26, fontWeight: 800 }}>{p.n}</span><strong>{p.label}</strong>
                <span style={{ fontSize: 13, color: T.ink2 }}>{p.sub}</span>
              </ChoiceCard>
            );
          })}
          <ChoiceCard $on={custom} aria-pressed={custom} onClick={() => setCustom(true)}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{custom ? s.dailyLimit : '5–60'}</span><strong>Custom</strong>
            <span style={{ fontSize: 13, color: T.ink2 }}>Any number from 5 to 60</span>
          </ChoiceCard>
        </Grid>
        {custom && (
          <Row $gap={10} style={{ marginTop: 12 }}>
            <label htmlFor="ap-custom" style={{ fontWeight: 600 }}>Applications a day</label>
            <Input id="ap-custom" type="number" min={5} max={60} value={s.dailyLimit} style={{ width: 90, textAlign: 'center', fontWeight: 700 }}
              onChange={(e) => set({ dailyLimit: Number(e.target.value) || 5 })}
              onBlur={() => set({ dailyLimit: Math.max(5, Math.min(60, s.dailyLimit)) })} />
          </Row>
        )}
        <Muted $size={13} style={{ marginTop: 10 }}>This is how many we get ready. Nothing is sent until you approve it.</Muted>
      </fieldset>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 10 }}>Which matches?</legend>
        {FITS.map((f) => (
          <ChoiceCard key={f.key} $row $on={s.fit === f.key} aria-pressed={s.fit === f.key} onClick={() => set({ fit: f.key })}>
            <Radio $on={s.fit === f.key} aria-hidden="true" />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><strong>{f.label}</strong><span style={{ fontSize: 14, color: T.ink2 }}>{f.sub}</span></span>
          </ChoiceCard>
        ))}
      </fieldset>
      <More>
        <summary>Limits (optional)</summary>
        <Col $gap={16} style={{ paddingTop: 14 }}>
          <Field as="div">
            <label htmlFor="ap-block">Never apply to these companies</label>
            <TagInput id="ap-block" values={s.blockedCompanies} onChange={(v) => set({ blockedCompanies: v })} placeholder="For example, your current employer" />
          </Field>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, cursor: 'pointer' }}>
            <input type="checkbox" checked={s.allowFederal} onChange={(e) => set({ allowFederal: e.target.checked })} style={{ width: 20, height: 20, accentColor: T.brand }} />
            Include government jobs that need a security clearance
          </label>
        </Col>
      </More>
    </Col>
  );
}

export function planSentence(s) {
  const titles = s.roleTitles.length ? s.roleTitles.slice(0, 2).join(' and ') + (s.roleTitles.length > 2 ? ` and ${s.roleTitles.length - 2} more` : '') : 'your';
  const where = s.workstyle.map((w) => w.toLowerCase()).join(' or ');
  const fit = FITS.find((f) => f.key === s.fit);
  return { titles, where, place: s.locations[0] || '', salary: s.salaryFloorK, daily: s.dailyLimit, fit: fit?.label?.toLowerCase() || '' };
}

export function MatchCount({ match }) {
  const total = match?.total;
  return (
    <Card $pad={22} $gap={8}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#4b3fc4' }}>MATCHING JOBS RIGHT NOW</span>
      <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>{total == null ? '…' : total}</span>
      <Muted $size={14}>Open jobs that fit what you've picked so far. It updates as you change things.</Muted>
      {total === 0 && <Chip $tone="warn">Try more titles or a lower salary</Chip>}
    </Card>
  );
}
