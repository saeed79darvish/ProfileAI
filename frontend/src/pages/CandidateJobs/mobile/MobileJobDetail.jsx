import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import {
  ArrowBackIosNew as BackIcon,
  IosShare as ShareIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkedIcon,
  Check as CheckIcon,
  Remove as DashIcon,
  AutoAwesome as SparkIcon,
  NorthEast as OutIcon,
  ExpandLess as UpIcon,
  ExpandMore as DownIcon,
} from '@mui/icons-material';
import { externalJobAPI } from '@/services/api';
import { formatTimeAgo } from '../utils';
import { hideWhileTyping } from '@/styles/keyboard';
import JobDescription, { QuickFacts, factsFromJob } from './JobDescription';

/**
 * A job on a phone, full screen over the app: a light header (back, share,
 * save) so the title is the first thing read, the free requirement match up
 * front (requirements read once per posting, your coverage checked in code),
 * the posting in sections (./JobDescription), and a two-button footer: Apply
 * and Tailor resume. Cover letter sits under "More options".
 */
const WORK_TONE = { onsite: ['#fff1e6', '#c2410c'], remote: ['#e6f6ec', '#1f7a45'], hybrid: ['#e8f0ff', '#2457c5'] };

// 100dvh, not inset: 0: on iOS a fixed box pinned to all four edges can run
// under the toolbar, which is how the last lines ended up behind the footer.
const Screen = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  height: 100dvh;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #13152a;
`;

const Bar = styled.header`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 56px;
  padding: 0 8px;
  border-bottom: 1px solid #eceef4;

  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 10px;
    border: none;
    background: none;
    font: inherit;
    font-size: 17px;
    font-weight: 600;
    color: #13152a;
    cursor: pointer;
    svg { font-size: 18px; }
  }
  .grow { flex: 1; }
  .icon {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 12px;
    background: none;
    color: #13152a;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    svg { font-size: 23px; }
  }
  .icon[aria-pressed='true'] { color: #4b4fc4; }
`;

const Body = styled.main`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 18px 16px 24px;

  .company { display: flex; align-items: center; gap: 12px; }
  .company .name { font-size: 17px; font-weight: 700; }
  .company .sub { margin-top: 2px; font-size: 14.5px; color: #6b7280; }
  h1 { margin: 16px 0 12px; font-size: 26px; font-weight: 800; line-height: 1.2; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag { padding: 6px 12px; border-radius: 10px; font-size: 14px; font-weight: 500; background: #f1f2f6; color: #4a4d63; }

  .similar { margin: 28px 0 10px; font-size: 17px; font-weight: 700; color: #1c1b33; }
`;

const MatchCard = styled.section`
  margin-top: 20px;
  padding: 16px;
  border-radius: 18px;
  background: #f6f5ff;
  border: 1px solid #e2defa;

  .top { display: flex; align-items: center; gap: 14px; }
  .ring {
    position: relative;
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    font-weight: 800;
  }
  .ring::before {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    background: #f6f5ff;
  }
  .ring span { position: relative; }
  .top > div:not(.ring) { flex: 1; min-width: 0; }
  .see { flex-shrink: 0; min-height: 44px; padding: 0 4px; border: none; background: none; font: inherit; font-size: 15px; font-weight: 600; color: #5b4bd6; cursor: pointer; }
  .verdict { font-size: 17px; font-weight: 700; }
  .count { margin-top: 2px; font-size: 14px; color: #6b7280; }
  ul { margin: 14px 0 0; padding: 0; list-style: none; }
  li { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 15px; color: #3d3f56; }
  .mark { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }
  .mark svg { font-size: 15px; }
  .partly { color: #8a8fa8; font-size: 13px; }
`;

const Similar = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  margin: 0 -16px;
  padding: 0 16px 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  button {
    flex: 0 0 78%;
    scroll-snap-align: start;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid #e8e9f0;
    background: #fff;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .t { font-size: 15.5px; font-weight: 700; line-height: 1.3; color: #13152a; }
  .s { margin-top: 4px; font-size: 13.5px; color: #6b7280; }
`;

// In the flex column, never over the content; the fade only softens the
// line the text scrolls out under.
const Footer = styled.footer`
  position: relative;
  flex-shrink: 0;
  padding: 6px 16px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid #eceef4;
  background: #fff;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    height: 16px;
    pointer-events: none;
    background: linear-gradient(rgba(255, 255, 255, 0), #fff);
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 100%;
    height: 34px;
    border: none;
    background: none;
    font: inherit;
    font-size: 14.5px;
    color: #5a5e7a;
    cursor: pointer;
    svg { font-size: 18px; }
  }
  .extra { display: flex; gap: 8px; margin-bottom: 8px; }
  .extra button {
    flex: 1;
    height: 44px;
    border-radius: 12px;
    border: 1.5px solid #e2e4ec;
    background: #fff;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: #13152a;
    cursor: pointer;
  }
  .main { display: flex; gap: 10px; }
  .apply, .tailor {
    height: 54px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: inherit;
    font-size: 17px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    svg { font-size: 18px; }
  }
  .apply { flex: 0 0 40%; border: 1.5px solid #e2e4ec; background: #fff; color: #13152a; }
  .tailor { flex: 1; border: none; background: #5b5fd6; color: #fff; }

  ${hideWhileTyping}
`;

const verdictFor = (score) => (score >= 85 ? 'Strong match' : score >= 70 ? 'Good match' : score >= 50 ? 'Partial match' : 'Stretch role');
const ringColor = (score) => (score >= 85 ? '#5b5fd6' : score >= 50 ? '#d08a2e' : '#c2410c');

export default function MobileJobDetail({
  job, isAuthenticated, saved, applied, onBack, onShare, onToggleSave,
  applyHref, onApply, onTailor, onCoverLetter, similarJobs = [], onOpenJob,
  descriptionHtml, renderLogo, sourceLabel, children,
}) {
  const [match, setMatch] = useState(undefined); // undefined loading, null none
  const [more, setMore] = useState(false);
  const bodyRef = useRef(null);
  const toList = useRef(null);

  useEffect(() => {
    setMore(false);
    if (!isAuthenticated || !job?._isExternal || !job?.id) { setMatch(null); return undefined; }
    let live = true;
    setMatch(undefined);
    externalJobAPI.getMatch(job.id)
      .then(({ data }) => { if (live) setMatch(data?.match || null); })
      .catch(() => { if (live) setMatch(null); });
    return () => { live = false; };
  }, [job?.id, job?._isExternal, isAuthenticated]);

  if (!job) return null;
  const work = String(job.locationType || '').toLowerCase();
  const [wbg, wfg] = WORK_TONE[work] || [];
  const posted = formatTimeAgo(job.postedAt || job.createdAt);
  const city = String(job.location || '').trim();
  const structured = job.descriptionStructured || null;
  const facts = structured?.facts || factsFromJob(job);
  // The requirements section marks each line from the match, so the card
  // only needs the score and a way there.
  const listBelow = !!structured?.sections?.some((x) => x.kind === 'requirements' || x.kind === 'niceToHave');

  return (
    <Screen role="dialog" aria-label={job.title}>
      <Bar>
        <button type="button" className="back" onClick={onBack}><BackIcon />Jobs</button>
        <span className="grow" />
        <button type="button" className="icon" aria-label="Share" onClick={onShare}><ShareIcon /></button>
        <button type="button" className="icon" aria-label={saved ? 'Unsave' : 'Save'} aria-pressed={saved} onClick={(e) => onToggleSave(e, job.id)}>
          {saved ? <BookmarkedIcon /> : <BookmarkIcon />}
        </button>
      </Bar>

      <Body ref={bodyRef}>
        <div className="company">
          {renderLogo(job, 56)}
          <div>
            <div className="name">{job.company}</div>
            <div className="sub">{[city, posted].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <h1>{job.title}</h1>
        <div className="tags">
          {applied && <span className="tag" style={{ background: '#e6f6ec', color: '#1f7a45' }}>Applied</span>}
          {wbg && <span className="tag" style={{ background: wbg, color: wfg }}>{work === 'onsite' ? 'Onsite' : work.charAt(0).toUpperCase() + work.slice(1)}</span>}
          {posted && <span className="tag">Posted {posted}</span>}
          {job.source && <span className="tag">via {sourceLabel(job.source)}</span>}
        </div>
        <QuickFacts facts={facts} showWorkMode={!wbg} />

        {isAuthenticated && job._isExternal && match !== null && (
          <MatchCard aria-live="polite">
            {match === undefined ? (
              <div className="top">
                <CircularProgress size={28} sx={{ color: '#5b5fd6' }} />
                <div className="count">Checking this job's requirements against your profile…</div>
              </div>
            ) : (
              <>
                <div className="top">
                  <div className="ring" style={{ background: `conic-gradient(${ringColor(match.score)} ${match.score * 3.6}deg, #e4e2f5 0)` }}>
                    <span>{match.score}%</span>
                  </div>
                  <div>
                    <div className="verdict">{verdictFor(match.score)}</div>
                    <div className="count">{match.met} of {match.total} requirements met</div>
                  </div>
                  {listBelow && <button type="button" className="see" onClick={() => toList.current?.()}>See list</button>}
                </div>
                {!listBelow && (
                <ul>
                  {match.requirements.map((r) => (
                    <li key={r.requirement}>
                      <span className="mark" style={{ background: r.status === 'met' ? '#22a05b' : r.status === 'partial' ? '#8fcfa7' : '#d6a24a' }}>
                        {r.status === 'missing' ? <DashIcon /> : <CheckIcon />}
                      </span>
                      <span>{r.requirement}{r.status === 'partial' && <span className="partly"> · partly</span>}</span>
                    </li>
                  ))}
                </ul>
                )}
              </>
            )}
          </MatchCard>
        )}

        <JobDescription
          job={job}
          structured={structured}
          descriptionHtml={descriptionHtml}
          match={match || null}
          scrollRef={bodyRef}
          listRef={toList}
          canTailor={isAuthenticated}
          onTailor={onTailor}
        />

        {similarJobs.length > 0 && (
          <>
            <h2 id="similar-jobs" className="similar">Similar jobs</h2>
            <Similar>
              {similarJobs.map((s) => (
                <button key={s.id} type="button" onClick={() => onOpenJob(s)}>
                  {renderLogo(s, 44)}
                  <span>
                    <div className="t">{s.title}</div>
                    <div className="s">{[s.company, s.locationType ? String(s.locationType).replace(/^\w/, (c) => c.toUpperCase()) : String(s.location || '').split(',')[0]].filter(Boolean).join(' · ')}</div>
                  </span>
                </button>
              ))}
            </Similar>
          </>
        )}
        {children}
      </Body>

      <Footer>
        <button type="button" className="toggle" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? 'Fewer options' : 'More options'} {more ? <DownIcon /> : <UpIcon />}
        </button>
        {more && (
          <div className="extra">
            <button type="button" onClick={onCoverLetter}>Cover letter</button>
          </div>
        )}
        <div className="main">
          {applyHref ? (
            <a className="apply" href={applyHref} target="_blank" rel="noopener noreferrer" onClick={onApply}>
              {applied ? 'Apply again' : 'Apply'} <OutIcon />
            </a>
          ) : (
            <button type="button" className="apply" onClick={onApply}>{applied ? 'Apply again' : 'Apply'} <OutIcon /></button>
          )}
          <button type="button" className="tailor" onClick={onTailor}><SparkIcon />Tailor resume</button>
        </div>
      </Footer>
    </Screen>
  );
}
