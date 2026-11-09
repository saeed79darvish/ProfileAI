import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { interviewPrepAPI } from '@/services/interviewPrep';
import { areaOptions, toggleArea, cleanFocus, focusSummary, COMPANY_TYPES, WORRIES, MAX_AREAS } from './targeting';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', brandInk: '#4b4fc4', soft: '#f0f0fc' };

const Box = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  h3 { margin: 18px 0 8px; font-size: 14px; font-weight: 700; color: #3b3e52; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid #d9dbe5; background: #fff; color: ${C.ink}; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
  .chip[aria-pressed='true'] { border-color: ${C.brand}; background: ${C.soft}; color: ${C.brandInk}; }
  .chip:focus-visible, .btn:focus-visible, .link:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; align-items: center; }
  .btn { min-height: 44px; padding: 0 20px; border-radius: 12px; border: none; background: ${C.brand}; color: #fff; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .link { border: none; background: none; padding: 0; min-height: 44px; font: inherit; font-size: 14.5px; font-weight: 600; color: ${C.brandInk}; cursor: pointer; }
  .err { margin-top: 12px; font-size: 14px; color: #b42318; }
  .now { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .now b { font-size: 15px; }
  .now .t { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 15px; line-height: 1.4; }
  .now .l { display: block; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; color: ${C.muted}; margin-bottom: 2px; }
  @media (min-width: 900px) { padding: 28px; h2 { font-size: 22px; } }
`;

/**
 * "Aim this prep": three tap questions (strongest areas, kind of company, biggest worry). Saved per person and prep,
 * and used to put matching questions first and steer voice practice. The shared research is not changed.
 */
export default function FocusCard({ prepId, role, level, focus, onSaved }) {
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState([]);
  const [companyType, setCompanyType] = useState('');
  const [worry, setWorry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const f = cleanFocus(focus);
    setAreas(f ? f.areas : []); setCompanyType(f ? f.companyType : ''); setWorry(f ? f.worry : '');
  }, [focus]);

  const options = areaOptions(role, level);
  const has = Boolean(cleanFocus(focus));
  const editing = open || !has;

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const res = await interviewPrepAPI.saveFocus(prepId, { areas, companyType, worry });
      onSaved(cleanFocus(res.data?.focus));
      setOpen(false);
    } catch {
      setErr('We could not save that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <Box aria-label="What you are aiming at">
        <div className="now">
          <div className="t"><span className="l">YOU ARE AIMING AT</span>{focusSummary(focus) || 'Your answers are saved'}</div>
          <button type="button" className="link" onClick={() => setOpen(true)}>Change</button>
        </div>
      </Box>
    );
  }

  return (
    <Box aria-labelledby="aim-h">
      <h2 id="aim-h">Aim this prep at your target</h2>
      <p className="sub">Three quick taps. The questions that match come first, and the practice coach leans on them. Your answers are only for you.</p>
      <h3 id="aim-a">Where do you want to be strongest? Pick up to {MAX_AREAS}.</h3>
      <div className="chips" role="group" aria-labelledby="aim-a">
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={areas.includes(o.id)} onClick={() => setAreas((a) => toggleArea(a, o.id))}>{o.label}</button>
        ))}
      </div>
      <h3 id="aim-c">What kind of company?</h3>
      <div className="chips" role="group" aria-labelledby="aim-c">
        {COMPANY_TYPES.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={companyType === o.id} onClick={() => setCompanyType(companyType === o.id ? '' : o.id)}>{o.label}</button>
        ))}
      </div>
      <h3 id="aim-w">What worries you most?</h3>
      <div className="chips" role="group" aria-labelledby="aim-w">
        {WORRIES.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={worry === o.id} onClick={() => setWorry(worry === o.id ? '' : o.id)}>{o.label}</button>
        ))}
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row">
        <button type="button" className="btn" onClick={save} disabled={busy || !(areas.length || companyType || worry)}>{busy ? 'Saving' : 'Save'}</button>
        {has && <button type="button" className="link" onClick={() => setOpen(false)}>Cancel</button>}
      </div>
    </Box>
  );
}
