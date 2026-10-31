import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, IconButton } from '@mui/material';
import { Close as CloseIcon, CheckRounded as CheckIcon } from '@mui/icons-material';
import styled, { keyframes } from 'styled-components';
import { externalJobAPI, careerContextAPI } from '@/services/api';
import { trackEvent } from '@/utils/analytics';
import { jobFiltersFrom } from '@/utils/jobPreferences';
import { takeCoachPicks } from '@/utils/coachPicks';
import { useJobMatches, scoreJob } from '@/utils/jobMatchStore';
import { matchTier } from '@/utils/jobMatchScore';
import CompanyMark from '@/components/CompanyMark';
import { TEXT, MAX_JOBS } from './constants';

/**
 * Jobs that fit the profile, over the profile page: after the coach, and
 * after every sign-in or sign-up (see utils/freshSignIn).
 *
 * Asked of the same endpoint, with the same sort and filters, that the jobs
 * page uses for its first page, so the order here is the order there, and a
 * tap opens that exact job on the jobs page, where the AI tools are. Their
 * work preferences (remote, contract...) become those filters: from the
 * coach when they just finished it, otherwise their saved ones, as the jobs
 * page reads them.
 *
 * Shows nothing at all when there are no jobs to show: an empty "we found
 * jobs for you" is worse than no pop-up.
 *
 * Someone who saw jobs on the coach's last card gets those first, with the
 * match score the card told them an account would unlock, scored as the
 * pop-up opens. Showing a different list here read as a bait and switch.
 * Every other job shows a score only when one is already stored (free).
 */

/* Coach answers onto job filters. Shared with the jobs page, which applies
   the same saved preferences on a fresh visit, so the pop-up and the page
   behind it always show the same list. */
export { jobFiltersFrom };

const salaryText = (job) => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sign = job.salaryCurrency === 'USD' || !job.salaryCurrency ? '$' : `${job.salaryCurrency} `;
  if (job.salaryMin && job.salaryMax) return `${sign}${k(job.salaryMin)} to ${sign}${k(job.salaryMax)}`;
  return `${sign}${k(job.salaryMin || job.salaryMax)}`;
};

const postedDays = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
};

const postedText = (iso) => {
  const days = postedDays(iso);
  if (days === null) return '';
  if (days === 0) return TEXT.POSTED_TODAY;
  if (days === 1) return TEXT.POSTED_YESTERDAY;
  return TEXT.POSTED_DAYS(days);
};

/* "Remote · Remote - United States" said it twice. */
const placeText = (job) => {
  const where = job.location || '';
  const type = TEXT.WORK_TYPE[job.locationType] || '';
  if (!type || where.toLowerCase().includes(type.toLowerCase())) return where;
  return [where, type].filter(Boolean).join(' · ');
};

const OnboardingMatches = ({ open, onClose, prefs }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);

  /* The coach's picks, read once when the pop-up first opens (reading
     clears them, so a later visit never sees them again). */
  const [picks, setPicks] = useState([]);
  const [unscored, setUnscored] = useState(() => new Set());
  const picksTakenRef = useRef(false);
  useEffect(() => {
    if (!open || picksTakenRef.current) return;
    picksTakenRef.current = true;
    const taken = takeCoachPicks();
    setPicks(taken);
    // The score the card promised: one read each, the same as tapping
    // "Score" on the jobs page. A failure just leaves that card unscored.
    taken.forEach((job) => {
      scoreJob(job.id).catch(() => setUnscored((prev) => new Set(prev).add(job.id)));
    });
  }, [open]);

  /* Preferences: the coach's, when it passed them; otherwise the saved
     ones, which is what the jobs page applies on a fresh visit. */
  const passed = prefs && Object.keys(prefs).length ? prefs : null;
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    if (!open || passed || saved) return undefined;
    let cancelled = false;
    careerContextAPI.get()
      .then((res) => { if (!cancelled) setSaved(res.data?.context?.constraints || {}); })
      .catch(() => { if (!cancelled) setSaved({}); });
    return () => { cancelled = true; };
  }, [open, passed, saved]);
  const ready = !!(passed || saved);
  const filters = useMemo(() => jobFiltersFrom(passed || saved || {}), [passed, saved]);
  const query = useMemo(
    () => new URLSearchParams({ sort: 'recommended', ...filters }).toString(),
    [filters]
  );

  useEffect(() => {
    if (!open || !ready) return undefined;
    let cancelled = false;
    externalJobAPI.getAll({ sort: 'recommended', page: 1, limit: MAX_JOBS, ...filters })
      .then(({ data }) => {
        if (cancelled) return;
        const found = (data?.jobs || []).slice(0, MAX_JOBS);
        setJobs(found);
        trackEvent('onboarding_matches_shown', { count: found.length, filtered: Object.keys(filters).length > 0 });
      })
      .catch(() => { if (!cancelled) setJobs([]); });
    return () => { cancelled = true; };
  }, [open, ready, filters]);

  const pickIds = new Set(picks.map((p) => p.id));
  const shown = jobs && [...picks, ...jobs.filter((j) => !pickIds.has(j.id))].slice(0, Math.max(MAX_JOBS, picks.length));
  // Stored scores for every card, free; the picks are also being scored.
  const scores = useJobMatches((shown || []).map((j) => j.id));

  // Nothing to show: never open an empty pop-up.
  useEffect(() => {
    if (open && jobs && !jobs.length && !picks.length) onClose();
  }, [open, jobs, picks, onClose]);

  const openJob = (job) => {
    trackEvent('onboarding_match_clicked', { jobId: job.id, picked: pickIds.has(job.id) });
    onClose();
    navigate(`/jobs?${query}&externalJobId=${encodeURIComponent(job.id)}`);
  };
  const seeAll = () => {
    trackEvent('onboarding_matches_see_all', {});
    onClose();
    navigate(`/jobs?${query}`);
  };

  const scoreBadge = (job) => {
    const tier = matchTier(scores[job.id]?.score);
    if (tier) {
      return (
        <span className="score" style={{ color: tier.color, background: `${tier.color}14` }}>
          {Math.round(scores[job.id].score)}% · {tier.label}
        </span>
      );
    }
    if (pickIds.has(job.id) && !unscored.has(job.id)) return <span className="score pending">{TEXT.SCORING}</span>;
    return null;
  };

  return (
    <Dialog
      open={open && !(jobs && !jobs.length && !picks.length)}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="matches-title"
      PaperProps={{ style: { borderRadius: 22 } }}
    >
      <Wrap>
        <IconButton aria-label={TEXT.CLOSE} onClick={onClose} className="close" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
        <span className="live"><i aria-hidden="true" />{TEXT.LIVE}</span>
        <h2 id="matches-title">{picks.length ? TEXT.PICKS_TITLE : TEXT.TITLE}</h2>
        <p className="sub">{picks.length ? TEXT.PICKS_SUB : TEXT.SUB}</p>

        {!shown ? (
          <Grid aria-busy="true" aria-label={TEXT.LOADING}>
            {Array.from({ length: MAX_JOBS }, (_, i) => <li key={i} className="skeleton" />)}
          </Grid>
        ) : (
          <Grid>
            {shown.map((job, i) => {
              const skills = (job.skills && pickIds.has(job.id) ? job.skills : job.matchedSkills) || [];
              const salary = salaryText(job);
              const posted = postedText(job.effectivePostedAt || job.postedAt);
              const fresh = postedDays(job.effectivePostedAt || job.postedAt) <= 3;
              return (
                <li key={job.id} style={{ animationDelay: `${i * 50}ms` }}>
                  <button type="button" onClick={() => openJob(job)}>
                    <span className="head">
                      <CompanyMark name={job.company} logoUrl={job.logoUrl || job.companyInfo?.logoUrl} size={40} />
                      <span className="who">
                        <strong>{job.title}</strong>
                        <span className="company">{job.company}</span>
                      </span>
                    </span>
                    {!!placeText(job) && <span className="place">{placeText(job)}</span>}
                    <span className="chips">
                      {scoreBadge(job)}
                      {!!salary && <span className="chip">{salary}</span>}
                      {!!posted && <span className={`chip${fresh ? ' fresh' : ''}`}>{posted}</span>}
                    </span>
                    {!!skills.length && (
                      <span className="skills">
                        <CheckIcon aria-hidden="true" />
                        {TEXT.YOU_HAVE} {skills.slice(0, 3).join(', ')}
                      </span>
                    )}
                    <span className="open">{TEXT.OPEN}</span>
                  </button>
                </li>
              );
            })}
          </Grid>
        )}

        <div className="actions">
          <button type="button" className="primary" onClick={seeAll} disabled={!jobs}>{TEXT.SEE_ALL}</button>
          <button type="button" className="secondary" onClick={onClose}>{TEXT.LATER}</button>
        </div>
      </Wrap>
    </Dialog>
  );
};

const rise = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`;

const shimmer = keyframes`
  from { background-position: -200px 0; }
  to { background-position: 200px 0; }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(34, 160, 107, 0.5); }
  70% { box-shadow: 0 0 0 7px rgba(34, 160, 107, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 160, 107, 0); }
`;

const Wrap = styled.div`
  position: relative;
  padding: 26px 28px 22px;
  color: #1a1a2e;
  background:
    radial-gradient(70% 50% at 0% 0%, rgba(99, 102, 241, 0.12), transparent 60%),
    radial-gradient(60% 40% at 100% 0%, rgba(14, 165, 233, 0.08), transparent 60%),
    #fff;

  .close { position: absolute; top: 14px; right: 14px; }

  .live {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #e8f7f0;
    color: #157a50;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22a06b;
      animation: ${pulse} 1.8s ease-out infinite;
    }
  }

  h2 {
    margin: 10px 32px 6px 0;
    font-size: 1.4rem;
    font-weight: 750;
    line-height: 1.25;
    text-wrap: balance;
  }

  .sub { margin: 0 0 18px; color: #6c6c86; font-size: 0.95rem; line-height: 1.45; }

  .actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }

  .actions button {
    border: none;
    border-radius: 12px;
    padding: 11px 20px;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .primary {
    background: linear-gradient(135deg, #6366f1, #7c85f5);
    color: #fff;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  }
  .primary:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
  .secondary { background: #f1f1f8; color: #3f3f5a; }

  @media (max-width: 600px) {
    padding: 22px 16px 0;
    h2 { font-size: 1.2rem; }
    /* Six cards stack past the fold; the way on stays in reach. */
    .actions {
      position: sticky;
      bottom: 0;
      margin: 16px -16px 0;
      padding: 12px 16px 16px;
      background: #fff;
      box-shadow: 0 -6px 16px rgba(26, 26, 46, 0.06);
    }
    .actions button { flex: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .live i { animation: none; }
  }
`;

const Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 600px) { grid-template-columns: 1fr; }

  li { animation: ${rise} 280ms ease both; }

  li.skeleton {
    height: 168px;
    border-radius: 16px;
    background: linear-gradient(90deg, #f3f3f9 0, #ebebf5 40px, #f3f3f9 80px) #f3f3f9;
    background-size: 400px 100%;
    animation: ${shimmer} 1.2s linear infinite;
  }

  button {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 16px;
    border: 1px solid #e4e5fb;
    border-radius: 16px;
    background: #fff;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  button:hover {
    transform: translateY(-2px);
    border-color: #b9bbf6;
    box-shadow: 0 8px 22px rgba(79, 70, 229, 0.14);
  }

  button:focus-visible { outline: 3px solid rgba(99, 102, 241, 0.45); outline-offset: 2px; }

  .head { display: flex; align-items: flex-start; gap: 12px; }
  .who { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .who strong { font-size: 0.98rem; font-weight: 700; line-height: 1.3; }
  .company { font-size: 0.88rem; color: #3f3f5a; }
  .place { font-size: 0.82rem; color: #8a8aa3; }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips:empty { display: none; }

  .chip, .score {
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 0.76rem;
    font-weight: 650;
    background: #f3f3fb;
    color: #3f3f5a;
  }
  .chip.fresh { background: #e8f7f0; color: #157a50; }
  .score { font-weight: 750; }
  .score.pending { background: #f3f3fb; color: #8a8aa3; font-weight: 600; }

  .skills {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #4338ca;

    svg { width: 15px; height: 15px; color: #22a06b; flex: none; }
  }

  .open {
    margin-top: auto;
    padding-top: 4px;
    font-size: 0.85rem;
    font-weight: 700;
    color: #4f46e5;
  }

  @media (prefers-reduced-motion: reduce) {
    li, li.skeleton { animation: none; }
    button { transition: none; }
    button:hover { transform: none; }
  }
`;

export default OnboardingMatches;
