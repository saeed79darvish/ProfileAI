import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Drawer, Snackbar, Button, CircularProgress, Portal } from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Tune as TuneIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkedIcon,
  AutoAwesome as SparkIcon,
  KeyboardArrowDown as ChevronIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { formatTimeAgo } from '../utils';
import { SALARY_OPTIONS } from '../constants';

/**
 * The jobs list on a phone: one search row with a single filter button, one
 * swipeable row of quick toggles, a "N jobs · Sort" row, and cards whose match
 * comes free from the server (job.match: requirements read once per posting,
 * your coverage checked in code). Everything else filters from a bottom sheet
 * with a live "Show N jobs". Hide has an Undo; the list loads as you scroll.
 */

const DATE_CHOICES = [
  { value: '', label: 'Any time' },
  { value: 'day', label: 'Past 24 hours' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
];
const WORK_TYPES = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];
const EXPERIENCE = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
];
const SALARY_CHOICES = [{ value: '', label: 'Any' }, ...SALARY_OPTIONS.filter((o) => o.min >= 100000).map((o) => ({ value: o.value, label: o.label }))];
const SHEET_KEYS = ['datePosted', 'locationType', 'experienceLevel', 'salary'];
const WORK_TONE = { onsite: ['#fff1e6', '#c2410c'], remote: ['#e6f6ec', '#1f7a45'], hybrid: ['#e8f0ff', '#2457c5'] };

const HIDDEN_KEY = 'profileai_hidden_jobs';
const loadHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch (_) { return new Set(); } };
const saveHidden = (set) => { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set].slice(-500))); } catch (_) { /* this browser only */ } };

const Wrap = styled.div`
  min-height: calc(100vh - 56px);
  background: #f3f4f8;
  color: #13152a;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
`;

const Top = styled.div`
  background: #fff;
  padding: 12px 16px 0;
  border-bottom: 1px solid #e8e9f0;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 10px;

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 8px 0 14px;
    border: 1.5px solid #e2e4ec;
    border-radius: 14px;
    background: #f7f8fb;
    box-sizing: border-box;
    &:focus-within { border-color: #5b5fd6; background: #fff; }
    svg { color: #6b7280; flex-shrink: 0; }
  }
  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 16px;
    color: #13152a;
  }
  .clear { border: none; background: none; padding: 6px; display: flex; color: #9ca3af; cursor: pointer; }
`;

const FilterBtn = styled.button`
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1.5px solid ${(p) => (p.$on ? '#5b5fd6' : '#e2e4ec')};
  background: ${(p) => (p.$on ? '#f0f0fc' : '#fff')};
  color: #4b4fc4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  .badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: #4b4fc4;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 20px;
    box-sizing: border-box;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 18px;
  margin-top: 10px;
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 0 10px;
    border: none;
    border-bottom: 3px solid transparent;
    background: none;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    color: #8a8fa8;
    cursor: pointer;
  }
  button[aria-selected='true'] { color: #13152a; border-bottom-color: #5b5fd6; }
  .count { padding: 1px 8px; border-radius: 999px; background: #eef0ff; color: #4b4fc4; font-size: 13px; }
`;

const Quick = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  /* The faded edge says the row scrolls. */
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
          mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
`;

const Pill = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$on ? '#5b5fd6' : '#e2e4ec')};
  background: ${(p) => (p.$on ? '#5b5fd6' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#13152a')};
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  svg { font-size: 16px; }
`;

const ResultsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 16px 10px;
  font-size: 15px;
  color: #5a5e7a;
  strong { color: #13152a; }
  button {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: none;
    background: none;
    font: inherit;
    font-size: 15px;
    color: #5a5e7a;
    cursor: pointer;
  }
  button b { color: #13152a; font-weight: 600; }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 12px;
`;

const Card = styled.article`
  padding: 16px 16px 10px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${(p) => (p.$top ? '#d9dafa' : '#e8e9f0')};

  .main { display: flex; gap: 12px; cursor: pointer; }
  .info { flex: 1; min-width: 0; }
  h3 { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3; color: #13152a; }
  .where { margin-top: 4px; font-size: 14.5px; color: #6b7280; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tag { padding: 4px 10px; border-radius: 8px; font-size: 13.5px; font-weight: 500; background: #f1f2f6; color: #5a5e7a; }
  .match {
    flex-shrink: 0;
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #f0f1f6;
  }
  .via { flex: 1; min-width: 0; font-size: 13.5px; color: #8a8fa8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 12px;
    background: none;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    svg { font-size: 22px; }
  }
  .icon[aria-pressed='true'] { color: #4b4fc4; }
  .tailor {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    background: #f0f0fc;
    color: #4b4fc4;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    svg { font-size: 16px; }
  }
`;

const Note = styled.p`
  margin: 18px 16px 8px;
  text-align: center;
  font-size: 14px;
  color: #8a8fa8;
`;

const Empty = styled.div`
  margin: 32px 16px;
  padding: 28px 20px;
  border-radius: 18px;
  background: #fff;
  border: 1px dashed #d9dbe5;
  text-align: center;
  h3 { margin: 0 0 6px; font-size: 17px; }
  p { margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #6b7280; }
  button {
    height: 44px;
    padding: 0 18px;
    border: none;
    border-radius: 12px;
    background: #5b5fd6;
    color: #fff;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
`;

const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 88dvh;
  .grab { width: 40px; height: 5px; border-radius: 999px; background: #d9dbe5; margin: 10px auto 0; }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 4px; }
  .head h2 { margin: 0; font-size: 20px; font-weight: 700; }
  .head button { width: 40px; height: 40px; border: none; background: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #13152a; }
  .body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
  h4 { margin: 18px 0 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #5a5e7a; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .row button {
    height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1.5px solid #e2e4ec;
    background: #fff;
    font: inherit;
    font-size: 15px;
    color: #13152a;
    cursor: pointer;
  }
  .row button[aria-pressed='true'] { border-color: #5b5fd6; background: #f0f0fc; color: #4b4fc4; font-weight: 600; }
  .foot {
    display: flex;
    gap: 10px;
    padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid #e8e9f0;
  }
  .foot button { height: 52px; border-radius: 14px; font: inherit; font-size: 16.5px; font-weight: 700; cursor: pointer; }
  .reset { flex: 0 0 34%; border: 1.5px solid #e2e4ec; background: #fff; color: #13152a; }
  .show { flex: 1; border: none; background: #5b5fd6; color: #fff; }
`;

const matchTone = (score) => (score >= 85 ? ['#e6f6ec', '#1f7a45'] : ['#fff4e2', '#b45309']);
// "Canada - Remote (ON, AB, BC)" is one place: the commas inside the brackets
// are not separators, and splitting on them left "Canada - Remote (ON".
const cityOf = (location) => String(location || '').replace(/\([^)]*\)/g, '').split(/[,;]/)[0].trim();
const sheetCount = (f) => SHEET_KEYS.filter((k) => f[k]).length;

export default function MobileJobsView({
  isAuthenticated,
  searchQuery, onSearchChange,
  activeTab, onTab, counts,
  filters, onFilter, onApplyFilters, onResetFilters, countFor,
  sortMode, onSort, suggestedRoles,
  jobs, loading, loadingMore, hasMore, onLoadMore, total,
  savedJobsList, applications, applicationsLoading, statusConfig,
  savedIds, appliedIds, onToggleSave, onOpen, onTailor,
  renderLogo, sourceLabel,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(filters);
  const [pendingCount, setPendingCount] = useState(null);
  const [hidden, setHidden] = useState(loadHidden);
  const [undo, setUndo] = useState(null);
  const sentinelRef = useRef(null);

  // Live "Show N jobs": the count for what the sheet shows, not what's applied.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    setPendingCount(null);
    let live = true;
    const t = setTimeout(() => {
      countFor(pending).then((n) => { if (live) setPendingCount(n); }).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, sheetOpen]);

  // Loads the next page as the end of the list comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || activeTab !== 'external') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && !loading) onLoadMore();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loading, onLoadMore, activeTab]);

  const openSheet = () => { setPending(filters); setSheetOpen(true); };
  const applySheet = () => { onApplyFilters(Object.fromEntries(SHEET_KEYS.map((k) => [k, pending[k] || '']))); setSheetOpen(false); };

  const hide = (job) => {
    const next = new Set(hidden);
    next.add(job.id);
    setHidden(next);
    saveHidden(next);
    setUndo(job);
  };
  const undoHide = () => {
    if (!undo) return;
    const next = new Set(hidden);
    next.delete(undo.id);
    setHidden(next);
    saveHidden(next);
    setUndo(null);
  };

  const visible = useMemo(() => (jobs || []).filter((j) => !hidden.has(j.id)), [jobs, hidden]);
  const toggleQuick = (key, value) => onFilter(key, filters[key] === value ? '' : value);
  const filterCount = sheetCount(filters) + (filters.location ? 1 : 0) + (filters.startup ? 1 : 0);

  const renderCard = (job, i) => {
    const m = job.match;
    const [bg, fg] = m ? matchTone(m.score) : [];
    const work = String(job.locationType || '').toLowerCase();
    const [wbg, wfg] = WORK_TONE[work] || [];
    const posted = formatTimeAgo(job.postedAt || job.createdAt);
    const saved = savedIds.has(job.id);
    return (
      <Card key={job.id} $top={i === 0 && m && m.score >= 85}>
        <div className="main" role="button" tabIndex={0} onClick={() => onOpen(job)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(job); }}>
          {renderLogo(job, 52)}
          <div className="info">
            <h3>{job.title}</h3>
            <div className="where">{[job.company, cityOf(job.location)].filter(Boolean).join(' · ')}</div>
            <div className="tags">
              {appliedIds.has(job.id) && <span className="tag" style={{ background: '#e6f6ec', color: '#1f7a45' }}>Applied</span>}
              {wbg && <span className="tag" style={{ background: wbg, color: wfg }}>{work === 'onsite' ? 'Onsite' : work.charAt(0).toUpperCase() + work.slice(1)}</span>}
              {posted && <span className="tag">{posted}</span>}
            </div>
          </div>
          {m && <span className="match" style={{ background: bg, color: fg }} title={`${m.met} of ${m.total} requirements met`}>{m.score}%</span>}
        </div>
        <div className="foot">
          <span className="via">{job.source ? `via ${sourceLabel(job.source)}` : ''}</span>
          <button type="button" className="icon" aria-label="Hide this job" onClick={() => hide(job)}><CloseIcon /></button>
          <button type="button" className="icon" aria-label={saved ? 'Unsave' : 'Save'} aria-pressed={saved} onClick={(e) => onToggleSave(e, job.id)}>
            {saved ? <BookmarkedIcon /> : <BookmarkIcon />}
          </button>
          <button type="button" className="tailor" onClick={() => onTailor(job)}><SparkIcon />Tailor</button>
        </div>
      </Card>
    );
  };

  const renderTabBody = () => {
    if (activeTab === 'saved') {
      if (!savedJobsList.length) {
        return (
          <Empty>
            <h3>No saved jobs yet</h3>
            <p>Tap the bookmark on any job to keep it here for later.</p>
            <button type="button" onClick={() => onTab('external')}>Browse jobs</button>
          </Empty>
        );
      }
      return <List>{savedJobsList.map(renderCard)}</List>;
    }
    if (activeTab === 'applied') {
      if (applicationsLoading) return <Note><CircularProgress size={22} /></Note>;
      if (!applications.length) {
        return (
          <Empty>
            <h3>No applications yet</h3>
            <p>Apply to a job and we'll track it here, with its status.</p>
            <button type="button" onClick={() => onTab('external')}>Find a job to apply to</button>
          </Empty>
        );
      }
      return (
        <List>
          {applications.map((app) => {
            const status = statusConfig[app.status] || { bg: '#f1f2f6', color: '#5a5e7a', label: app.status };
            const job = app.job || app;
            return (
              <Card key={app.id}>
                <div className="main" role="button" tabIndex={0} onClick={() => job && job.id && onOpen(job)}>
                  {renderLogo(job, 44)}
                  <div className="info">
                    <h3>{job.title || app.jobTitle}</h3>
                    <div className="where">{job.company || app.companyName}</div>
                    <div className="tags">
                      <span className="tag" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                      {app.createdAt && <span className="tag">Applied {formatTimeAgo(app.createdAt)}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </List>
      );
    }
    if (loading && !visible.length) return <Note><CircularProgress size={24} sx={{ color: '#5b5fd6' }} /></Note>;
    if (!visible.length) {
      return (
        <Empty>
          <h3>No jobs match these filters</h3>
          <p>Try fewer filters or a wider date range.</p>
          <button type="button" onClick={onResetFilters}>Reset filters</button>
        </Empty>
      );
    }
    return (
      <>
        <List>{visible.map(renderCard)}</List>
        <div ref={sentinelRef} />
        {loadingMore && <Note><CircularProgress size={22} sx={{ color: '#5b5fd6' }} /></Note>}
        {!hasMore && !loadingMore && <Note>That's every job for these filters.</Note>}
      </>
    );
  };

  return (
    <Wrap>
      <Top>
        <SearchRow>
          <label className="search">
            <SearchIcon />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search jobs, skills…"
              aria-label="Search jobs"
              enterKeyHint="search"
            />
            {searchQuery && (
              <button type="button" className="clear" aria-label="Clear search" onClick={() => onSearchChange('')}><CloseIcon fontSize="small" /></button>
            )}
          </label>
          <FilterBtn type="button" $on={filterCount > 0} onClick={openSheet} aria-label={`Filters${filterCount ? `, ${filterCount} on` : ''}`}>
            <TuneIcon />
            {filterCount > 0 && <span className="badge">{filterCount}</span>}
          </FilterBtn>
        </SearchRow>
        {isAuthenticated && (
          <Tabs role="tablist">
            {[['external', 'Discover', counts.external], ['saved', 'Saved', counts.saved], ['applied', 'Applied', counts.applied]].map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => onTab(id)}>
                {label}<span className="count">{Number(n || 0).toLocaleString()}</span>
              </button>
            ))}
          </Tabs>
        )}
      </Top>

      {activeTab === 'external' && (
        <>
          <Quick aria-label="Quick filters">
            {filters.location && (
              <Pill type="button" $on onClick={() => onFilter('location', '')} aria-label={`Remove ${filters.location}`}>
                {cityOf(filters.location)}<CloseIcon />
              </Pill>
            )}
            <Pill type="button" $on={filters.locationType === 'remote'} onClick={() => toggleQuick('locationType', 'remote')}>Remote</Pill>
            <Pill type="button" $on={filters.datePosted === 'week'} onClick={() => toggleQuick('datePosted', 'week')}>Past week</Pill>
            <Pill type="button" $on={filters.locationType === 'hybrid'} onClick={() => toggleQuick('locationType', 'hybrid')}>Hybrid</Pill>
            <Pill type="button" $on={!!filters.startup} onClick={() => onFilter('startup', !filters.startup)}>Startups</Pill>
          </Quick>
          {suggestedRoles && (
            <Quick aria-label="Suggested roles">
              <span style={{ alignSelf: 'center', flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#667085', whiteSpace: 'nowrap' }}>Start with</span>
              {suggestedRoles.map((role) => (
                <Pill key={role} type="button" onClick={() => onSearchChange(role)}>{role}</Pill>
              ))}
            </Quick>
          )}
          <ResultsRow>
            <span><strong>{Number(total || 0).toLocaleString()}</strong> jobs</span>
            {/* With no profile and no search, "Relevance" and "Newest" are the
                same list, so there is nothing to switch. */}
            {!isAuthenticated && !String(searchQuery || '').trim() ? (
              <span>Sorted by&nbsp;<b>Newest</b></span>
            ) : (
              <button type="button" onClick={() => onSort(sortMode === 'recent' ? 'recommended' : 'recent')} aria-label="Change sort">
                Sort:&nbsp;<b>{sortMode === 'recent' ? 'Newest' : (isAuthenticated ? 'Best match' : 'Relevance')}</b><ChevronIcon fontSize="small" />
              </button>
            )}
          </ResultsRow>
        </>
      )}
      {activeTab !== 'external' && <div style={{ height: 12 }} />}

      {renderTabBody()}

      <Drawer anchor="bottom" open={sheetOpen} onClose={() => setSheetOpen(false)} PaperProps={{ sx: { borderTopLeftRadius: 22, borderTopRightRadius: 22 } }}>
        <Sheet>
          <div className="grab" />
          <div className="head">
            <h2>Filters</h2>
            <button type="button" aria-label="Close filters" onClick={() => setSheetOpen(false)}><CloseIcon /></button>
          </div>
          <div className="body">
            {[
              ['Date posted', 'datePosted', DATE_CHOICES],
              ['Work type', 'locationType', WORK_TYPES],
              ['Experience', 'experienceLevel', EXPERIENCE],
              ['Minimum salary', 'salary', SALARY_CHOICES],
            ].map(([title, key, choices]) => (
              <section key={key}>
                <h4>{title}</h4>
                <div className="row">
                  {choices.map((c) => {
                    const on = (pending[key] || '') === c.value;
                    return (
                      <button
                        key={c.value || 'any'}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPending((p) => ({ ...p, [key]: on && c.value ? '' : c.value }))}
                      >
                        {on && c.value && <CheckIcon style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 4 }} />}{c.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="foot">
            <button type="button" className="reset" onClick={() => setPending((p) => ({ ...p, ...Object.fromEntries(SHEET_KEYS.map((k) => [k, ''])) }))}>Reset</button>
            <button type="button" className="show" onClick={applySheet}>
              {pendingCount == null ? 'Show jobs' : `Show ${pendingCount.toLocaleString()} job${pendingCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </Sheet>
      </Drawer>

      {/* Portaled: rendered in place it sat under the job cards. */}
      <Portal>
      <Snackbar
        open={!!undo}
        autoHideDuration={5000}
        onClose={() => setUndo(null)}
        message="Job hidden"
        action={<Button size="small" onClick={undoHide}>Undo</Button>}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      </Portal>
    </Wrap>
  );
}
