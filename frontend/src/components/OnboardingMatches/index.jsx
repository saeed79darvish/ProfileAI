import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, IconButton, CircularProgress } from '@mui/material';
import { Close as CloseIcon, WorkOutline as JobIcon } from '@mui/icons-material';
import styled from 'styled-components';
import { externalJobAPI } from '@/services/api';
import { trackEvent } from '@/utils/analytics';
import { TEXT, MAX_JOBS } from './constants';

/**
 * The payoff at the end of onboarding: jobs that fit the profile they just
 * built, on the first visit to it.
 *
 * Asked of the same endpoint, with the same sort and filters, that the jobs
 * page uses for its first page, so the order here is the order there. Their
 * work preferences from the coach (remote, contract...) become those
 * filters; they were deliberately kept off the profile and resume, and this
 * is where they belong.
 *
 * Shows nothing at all when there are no jobs to show: an empty "we found
 * jobs for you" is worse than no pop-up.
 */

/* Coach answers onto job filters. "Flexible" and several picked types mean
   no filter, which is what the jobs page calls "Any". */
export const jobFiltersFrom = (prefs = {}) => {
  const filters = {};
  if (['remote', 'hybrid', 'onsite'].includes(prefs.workStyle)) filters.locationType = prefs.workStyle;
  const types = (prefs.roleTypes || []).filter((t) => ['full-time', 'part-time', 'contract', 'internship'].includes(t));
  if (types.length === 1 && (prefs.roleTypes || []).length === 1) filters.employmentType = types[0];
  return filters;
};

const salaryText = (job) => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sign = job.salaryCurrency === 'USD' || !job.salaryCurrency ? '$' : `${job.salaryCurrency} `;
  if (job.salaryMin && job.salaryMax) return `${sign}${k(job.salaryMin)} to ${sign}${k(job.salaryMax)}`;
  return `${sign}${k(job.salaryMin || job.salaryMax)}`;
};

const postedText = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return TEXT.POSTED_TODAY;
  if (days === 1) return TEXT.POSTED_YESTERDAY;
  return TEXT.POSTED_DAYS(days);
};

const OnboardingMatches = ({ open, onClose, prefs }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const filters = useMemo(() => jobFiltersFrom(prefs), [prefs]);
  const query = useMemo(
    () => new URLSearchParams({ sort: 'recommended', ...filters }).toString(),
    [filters]
  );

  useEffect(() => {
    if (!open) return undefined;
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
  }, [open, filters]);

  // Nothing to show: never open an empty pop-up.
  useEffect(() => {
    if (open && jobs && !jobs.length) onClose();
  }, [open, jobs, onClose]);

  const openJob = (job) => {
    trackEvent('onboarding_match_clicked', { jobId: job.id });
    onClose();
    navigate(`/jobs?${query}&externalJobId=${encodeURIComponent(job.id)}`);
  };
  const seeAll = () => {
    trackEvent('onboarding_matches_see_all', {});
    onClose();
    navigate(`/jobs?${query}`);
  };

  return (
    <Dialog open={open && !(jobs && !jobs.length)} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="matches-title">
      <Wrap>
        <IconButton aria-label={TEXT.CLOSE} onClick={onClose} className="close" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
        <h2 id="matches-title">{TEXT.TITLE}</h2>
        <p className="sub">{TEXT.SUB}</p>

        {!jobs ? (
          <div className="loading"><CircularProgress size={28} /><span>{TEXT.LOADING}</span></div>
        ) : (
          <ul>
            {jobs.map((job) => {
              const details = [
                job.location,
                job.locationType && TEXT.WORK_TYPE[job.locationType],
                salaryText(job),
              ].filter(Boolean);
              return (
                <li key={job.id}>
                  <button type="button" onClick={() => openJob(job)}>
                    <span className="icon" aria-hidden="true"><JobIcon fontSize="small" /></span>
                    <span className="text">
                      <strong>{job.title}</strong>
                      <span className="company">{job.company}</span>
                      {!!details.length && <span className="meta">{details.join(' · ')}</span>}
                    </span>
                    <span className="posted">{postedText(job.effectivePostedAt || job.postedAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="actions">
          <button type="button" className="primary" onClick={seeAll} disabled={!jobs}>{TEXT.SEE_ALL}</button>
          <button type="button" className="secondary" onClick={onClose}>{TEXT.LATER}</button>
        </div>
      </Wrap>
    </Dialog>
  );
};

const Wrap = styled.div`
  position: relative;
  padding: 28px 28px 24px;
  color: #1a1a2e;

  .close { position: absolute; top: 12px; right: 12px; }

  h2 {
    margin: 0 32px 6px 0;
    font-size: 1.35rem;
    font-weight: 700;
    text-wrap: balance;
  }

  .sub { margin: 0 0 18px; color: #6c6c86; font-size: 0.95rem; line-height: 1.45; }

  .loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px 0;
    color: #6c6c86;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  li > button {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #ececf3;
    border-radius: 14px;
    background: #fff;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease;
  }

  li > button:hover { border-color: #c7c8f5; background: #f8f8ff; }

  .icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #eeeefc;
    color: #6366f1;
  }

  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .text strong { font-size: 0.98rem; font-weight: 650; line-height: 1.3; }
  .company { font-size: 0.9rem; color: #3f3f5a; }
  .meta { font-size: 0.82rem; color: #8a8aa3; }
  .posted { flex-shrink: 0; font-size: 0.78rem; color: #8a8aa3; padding-top: 2px; }

  .actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }

  .actions button {
    border: none;
    border-radius: 12px;
    padding: 11px 18px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary { background: #6366f1; color: #fff; }
  .primary:hover:not(:disabled) { background: #5457e5; }
  .primary:disabled { opacity: 0.5; cursor: default; }
  .secondary { background: #f1f1f8; color: #3f3f5a; }

  @media (max-width: 480px) {
    padding: 22px 16px 18px;
    .posted { display: none; }
    .actions button { flex: 1; }
  }
`;

export default OnboardingMatches;
