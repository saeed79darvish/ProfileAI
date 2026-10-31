import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  LockOutlined as LockIcon,
  CheckRounded as CheckIcon,
  PlaceOutlined as PlaceIcon,
  AutoAwesome as SparkIcon,
} from '@mui/icons-material';
import CompanyMark from '@/components/CompanyMark';
import { JOB_PICKS_TEXT as TEXT } from './constants';

/**
 * The jobs card at the end of the coach: three live openings that fit the
 * profile they just built, the first one large.
 *
 * Everything on it is real and theirs: the posting, the place, and the
 * skills of THEIRS each posting asks for. The match score is the one thing
 * held back, because the feed only shows the graded score and that needs
 * an account. Tapping a job is the way into the account, and lands on it.
 */

const daysSince = (date) => {
  const at = new Date(date).getTime();
  return Number.isFinite(at) ? Math.max(0, Math.floor((Date.now() - at) / 86400000)) : null;
};

const postedText = (date) => {
  const days = daysSince(date);
  if (days === null) return '';
  if (days === 0) return TEXT.POSTED_TODAY;
  if (days === 1) return TEXT.POSTED_YESTERDAY;
  return TEXT.POSTED_DAYS(days);
};

const salaryText = (job) => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sign = !job.salaryCurrency || job.salaryCurrency === 'USD' ? '$' : `${job.salaryCurrency} `;
  if (job.salaryMin && job.salaryMax) return `${sign}${k(job.salaryMin)} to ${sign}${k(job.salaryMax)}`;
  return `${sign}${k(job.salaryMin || job.salaryMax)}`;
};

const Logo = ({ job, size }) => <CompanyMark name={job.company} logoUrl={job.logoUrl} size={size} />;

const JobPicks = ({ jobs, onOpen, busy }) => {
  const [top, ...rest] = jobs;

  const meta = (job) => [job.company, job.location].filter(Boolean).join(' · ');

  return (
    <Wrap>
      <Head>
        <Live><i aria-hidden="true" />{TEXT.LIVE}</Live>
        <h4>{TEXT.TITLE(jobs.length)}</h4>
        <p>{TEXT.SUB}</p>
      </Head>

      <Featured type="button" onClick={() => onOpen(top)} disabled={busy}>
        <TopBadge><SparkIcon aria-hidden="true" />{TEXT.TOP_PICK}</TopBadge>
        <FeaturedHead>
          <Logo job={top} size={48} />
          <div>
            <h5>{top.title}</h5>
            <span className="meta">{meta(top)}</span>
          </div>
        </FeaturedHead>

        <Facts>
          {top.locationType === 'remote' && !/remote/i.test(top.location || '') && <span><PlaceIcon aria-hidden="true" />{TEXT.REMOTE}</span>}
          {!!salaryText(top) && <span>{salaryText(top)}</span>}
          {!!postedText(top.postedAt) && <span className={daysSince(top.postedAt) <= 3 ? 'fresh' : ''}>{postedText(top.postedAt)}</span>}
        </Facts>

        {!!top.skills?.length && (
          <Skills>
            <span className="label">{TEXT.YOU_HAVE}</span>
            {top.skills.map((s) => <span key={s} className="skill"><CheckIcon aria-hidden="true" />{s}</span>)}
          </Skills>
        )}

        <FeaturedFoot>
          <Locked><LockIcon aria-hidden="true" />{TEXT.SCORE_LOCKED}</Locked>
          <ApplyButton as="span">{TEXT.APPLY}</ApplyButton>
        </FeaturedFoot>
      </Featured>

      <List>
        {rest.map((job) => (
          <li key={job.id}>
            <Compact type="button" onClick={() => onOpen(job)} disabled={busy}>
              <Logo job={job} size={38} />
              <div className="body">
                <h5>{job.title}</h5>
                <span className="meta">{[meta(job), postedText(job.postedAt)].filter(Boolean).join(' · ')}</span>
                {!!job.skills?.length && (
                  <span className="skills">
                    <CheckIcon aria-hidden="true" />{job.skills.slice(0, 3).join(', ')}
                  </span>
                )}
              </div>
              <span className="cta">{TEXT.VIEW}</span>
            </Compact>
          </li>
        ))}
      </List>

      <Foot>{TEXT.FOOT}</Foot>
    </Wrap>
  );
};

/* ─── Styles ──────────────────────────────────────────────────── */

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(34, 160, 107, 0.5); }
  70% { box-shadow: 0 0 0 7px rgba(34, 160, 107, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 160, 107, 0); }
`;

const Wrap = styled.div`
  box-sizing: border-box;
  width: 100%;
  max-width: min(600px, 92%);
  margin-left: 50px;
  padding: 20px 20px 16px;
  border-radius: 20px;
  background:
    radial-gradient(120% 80% at 0% 0%, rgba(99, 102, 241, 0.14), transparent 60%),
    radial-gradient(90% 70% at 100% 0%, rgba(14, 165, 233, 0.1), transparent 60%),
    #fff;
  border: 1px solid #dfe0fb;
  box-shadow: 0 10px 34px rgba(79, 70, 229, 0.14);
  animation: ${rise} 360ms ease both;

  @media (max-width: 480px) {
    margin-left: 0;
    max-width: 100%;
    padding: 16px 14px 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Head = styled.div`
  margin-bottom: 14px;

  h4 {
    margin: 8px 0 4px;
    font-size: 1.22rem;
    font-weight: 750;
    line-height: 1.25;
    color: #1a1a2e;
    text-wrap: balance;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
    color: #6c6c86;
  }
`;

const Live = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e8f7f0;
  color: #157a50;
  font-size: 0.74rem;
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

  @media (prefers-reduced-motion: reduce) {
    i { animation: none; }
  }
`;

const tile = css`
  width: 100%;
  border: 1px solid #e4e5fb;
  background: #fff;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: #b9bbf6;
    box-shadow: 0 8px 22px rgba(79, 70, 229, 0.16);
  }

  &:focus-visible {
    outline: 3px solid rgba(99, 102, 241, 0.45);
    outline-offset: 2px;
  }

  &:disabled { cursor: default; opacity: 0.7; }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover:not(:disabled) { transform: none; }
  }

  h5 {
    margin: 0;
    color: #1a1a2e;
    font-weight: 700;
    line-height: 1.3;
  }

  .meta {
    display: block;
    margin-top: 3px;
    font-size: 0.86rem;
    color: #6c6c86;
  }
`;

const Featured = styled.button`
  ${tile}
  position: relative;
  display: block;
  padding: 18px 18px 16px;
  border-radius: 16px;
  border-color: #c9cbf8;
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.1);

  h5 { font-size: 1.1rem; padding-right: 92px; }

  @media (max-width: 480px) {
    padding: 16px 14px 14px;
    h5 { padding-right: 0; }
  }
`;

const TopBadge = styled.span`
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;

  svg { width: 13px; height: 13px; }

  @media (max-width: 480px) {
    position: static;
    margin-bottom: 10px;
  }
`;

const FeaturedHead = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;

  > div { min-width: 0; }
`;

const Facts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #f3f3fb;
    color: #3f3f5a;
    font-size: 0.8rem;
    font-weight: 600;
  }

  span.fresh { background: #e8f7f0; color: #157a50; }
  svg { width: 15px; height: 15px; }

  &:empty { display: none; }
`;

const Skills = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 12px;

  .label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #6c6c86;
    margin-right: 2px;
  }

  .skill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 9px 3px 6px;
    border-radius: 8px;
    background: #eef0ff;
    color: #4338ca;
    font-size: 0.82rem;
    font-weight: 600;
  }

  svg { width: 15px; height: 15px; color: #22a06b; }
`;

const FeaturedFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #e0e1f5;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const Locked = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  color: #6c6c86;

  svg { width: 17px; height: 17px; color: #8b8cf0; }
`;

const ApplyButton = styled.span`
  flex: none;
  display: inline-flex;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #7c85f5);
  color: #fff;
  font-weight: 700;
  font-size: 0.92rem;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
`;

const List = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
`;

const Compact = styled.button`
  ${tile}
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;

  .body { flex: 1; min-width: 0; }
  h5 { font-size: 0.96rem; }

  .skills {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #4338ca;

    svg { width: 14px; height: 14px; color: #22a06b; }
  }

  .cta {
    flex: none;
    font-size: 0.85rem;
    font-weight: 700;
    color: #4f46e5;
  }

  @media (max-width: 480px) {
    .cta { display: none; }
  }
`;

const Foot = styled.p`
  margin: 12px 2px 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #8a8aa3;
`;

export default JobPicks;
