import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import {
  Dialog,
  Box,
  Skeleton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Work as JobIcon,
  TrendingUp as TrendingIcon,
  History as HistoryIcon,
  ArrowForward as ArrowIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { jobAPI, externalJobAPI } from '../services/api';

// ── Animations ──
const fadeIn = keyframes`from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); }`;

// ── Styled Components ──
const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 16px;
    max-width: 760px;
    width: 100%;
    max-height: 85vh;
    background: #FAFAFA;
    overflow: visible;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(0,0,0,0.15);
  }
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #F0F0F0;
  background: white;
`;

const SearchInputEl = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  font-size: 17px;
  color: #1a1a1a;
  background: transparent;
  font-family: inherit;
  text-overflow: ellipsis;
  &::placeholder { color: #A0A0A0; }
`;

const KbdButton = styled.button`
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #E0E0E0;
  background: white;
  color: #666;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #F5F5F5; }
`;

const ClearBtn = styled.button`
  padding: 5px 14px;
  border-radius: 8px;
  border: 1.5px solid #7C3AED;
  background: white;
  color: #7C3AED;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #F5F3FF; }
`;

const TabsRow = styled.div`
  display: flex;
  gap: 4px;
  padding: 10px 20px;
  background: white;
  border-bottom: 1px solid #F0F0F0;
`;

const Tab = styled.button`
  padding: 7px 16px;
  border-radius: 20px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${p => p.$active ? '#7C3AED' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#666'};
  &:hover { background: ${p => p.$active ? '#7C3AED' : '#F5F5F5'}; }
`;

const TabCount = styled.span`
  font-size: 11px;
  font-weight: 700;
  opacity: 0.8;
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  background: white;
  border-bottom: 1px solid #F0F0F0;
  flex-wrap: wrap;
  align-items: center;
  position: relative;
  z-index: 10;
  overflow: visible;
`;

const FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  border: 1.5px solid ${p => p.$active ? '#7C3AED' : '#E5E7EB'};
  background: ${p => p.$active ? '#7C3AED' : 'white'};
  color: ${p => p.$active ? 'white' : '#4B5563'};
  &:hover { border-color: #7C3AED; }
`;

const FilterDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  border: 1px solid #E5E7EB;
  z-index: 200;
  min-width: 180px;
  padding: 6px 0;
  animation: ${fadeIn} 0.15s ease;
`;

const DropdownItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: ${p => p.$active ? '#7C3AED' : '#1F2937'};
  font-weight: ${p => p.$active ? 700 : 400};
  cursor: pointer;
  text-align: left;
  &:hover { background: #F5F3FF; }
`;

const ResetLink = styled.button`
  border: none;
  background: transparent;
  color: #EF4444;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  padding: 5px 8px;
  &:hover { text-decoration: underline; }
`;

const Content = styled.div`
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-bottom: 0;
`;

const Section = styled.div`
  padding: 14px 20px 8px;
`;

const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ResultRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: #F8F8F8;
    .arrow { opacity: 1; }
  }
`;

const JobLogo = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${p => p.$bg || 'rgba(124,58,237,0.1)'};
  color: ${p => p.$color || '#7C3AED'};
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  img { width: 100%; height: 100%; object-fit: cover; }
`;

const Info = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Sub = styled.div`
  font-size: 12.5px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MatchBadge = styled.span`
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  background: ${p => p.$high ? '#F0FDF4' : '#FFF7ED'};
  color: ${p => p.$high ? '#16A34A' : '#EA580C'};
`;

const Arrow = styled(ArrowIcon)`
  color: #CCC;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
`;

const QuickActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  cursor: pointer;
  border-bottom: 1px solid #F5F5F5;
  transition: background 0.15s;
  &:hover { background: #F8F8F8; }
  &:last-child { border-bottom: none; }
`;

const QAIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.$bg || '#7C3AED'};
  color: white;
`;

const RecentTrendingRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
  padding: 0 20px 16px;
`;

const RTColumn = styled.div``;

const RTLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const RTItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  &:hover { color: #7C3AED; }
`;

const HotBadge = styled.span`
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  background: #FEE2E2;
  color: #EF4444;
  margin-left: auto;
`;

const ViewAllBtn = styled.button`
  display: block;
  width: calc(100% - 40px);
  margin: 8px 20px 16px;
  padding: 14px;
  border-radius: 12px;
  border: 2px solid #7C3AED;
  background: white;
  color: #7C3AED;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
  &:hover { background: #F5F3FF; }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #F9FAFB;
  border-top: 1px solid #F0F0F0;
  font-size: 12px;
  color: #9CA3AF;
`;

const Kbd = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #E0E0E0;
  background: white;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  min-width: 20px;
`;

const FooterItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

// ── Skeleton Components ──
const SkeletonRow = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 12px' }}>
    <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '10px' }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton width="60%" height={18} />
      <Skeleton width="40%" height={14} sx={{ mt: 0.5 }} />
    </Box>
    <Skeleton width={60} height={20} sx={{ borderRadius: '12px' }} />
  </Box>
);

// ── Filter config ──
const FILTER_CONFIG = {
  location: { label: 'Location', key: 'location', type: 'text', placeholder: 'City, country...' },
  workType: { label: 'Work Type', key: 'locationType', options: [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'onsite', label: 'On-site' },
  ]},
  datePosted: { label: 'Date Posted', key: 'datePosted', options: [
    { value: 'day', label: 'Past 24 hours' },
    { value: '3days', label: 'Past 3 days' },
    { value: 'week', label: 'Past week' },
    { value: '2weeks', label: 'Past 2 weeks' },
    { value: 'month', label: 'Past month' },
    { value: '3months', label: 'Past 3 months' },
    { value: '', label: 'Any time' },
  ]},
  experience: { label: 'Experience', key: 'experienceLevel', options: [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' },
    { value: 'lead', label: 'Lead' },
    { value: 'executive', label: 'Executive' },
  ]},
  jobType: { label: 'Job Type', key: 'employmentType', options: [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
  ]},
};

const TRENDING = [
  { text: 'AI Engineer', hot: true },
  { text: 'Staff Frontend', hot: false },
  { text: 'Series B startups', hot: true },
];

// Filters were removed from the spotlight, they belong on the list page.
// This empty set is referenced by the search-build logic below; keeping it at
// module scope gives it a stable identity so effects don't re-run on every render.
const EMPTY_FILTERS = Object.freeze({ location: '', locationType: '', datePosted: '', experienceLevel: '', employmentType: '' });

const RECENT_KEY = 'profileai_recent_searches';
const getRecentSearches = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 3); }
  catch { return []; }
};
const saveRecentSearch = (q) => {
  try {
    const recent = getRecentSearches().filter(r => r !== q);
    recent.unshift(q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {}
};

// ── Component ──
const GlobalSearchDialog = ({ open, onClose, defaultCategory = 'all', initialQuery = '' }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(defaultCategory);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ jobs: [] });
  const [counts, setCounts] = useState({ jobs: 0 });
  const filters = EMPTY_FILTERS;
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const hasFilters = false;
  const hasResults = results.jobs.length > 0;

  // Focus & reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setRecentSearches(getRecentSearches());
      setQuery(initialQuery);
      setCategory(defaultCategory);
    } else {
      setQuery('');
      setCategory(defaultCategory);
      setResults({ jobs: [] });
      setCounts({ jobs: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults({ jobs: [] });
      setCounts({ jobs: 0 });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const promises = [];
        const filterParams = {};
        if (filters.location) filterParams.location = filters.location;
        if (filters.locationType) filterParams.locationType = filters.locationType;
        if (filters.datePosted) filterParams.datePosted = filters.datePosted;
        if (filters.experienceLevel) filterParams.experienceLevel = filters.experienceLevel;
        if (filters.employmentType) filterParams.employmentType = filters.employmentType;

        const jobLimit = 15;

        // Jobs
        promises.push(
          Promise.all([
            jobAPI.getAll({ search: query, limit: jobLimit, ...filterParams }).then(r => r.data).catch(() => ({ jobs: [], pagination: { total: 0 } })),
            externalJobAPI.getAll({ search: query, limit: jobLimit, ...filterParams }).then(r => r.data).catch(() => ({ jobs: [], pagination: { total: 0 } })),
          ]).then(([platform, external]) => {
            const q = query.toLowerCase();
            const all = [
              ...(platform.jobs || []),
              ...(external.jobs || []).map(j => ({ ...j, _isExternal: true })),
            ];
            all.forEach(j => {
              const t = (j.title || '').toLowerCase();
              const c = (j.company || '').toLowerCase();
              j._score = t.includes(q) ? 2 : c.includes(q) ? 1 : 0;
            });
            all.sort((a, b) => b._score - a._score || new Date(b.postedAt || b.createdAt) - new Date(a.postedAt || a.createdAt));
            const total = (platform.pagination?.total || 0) + (external.pagination?.total || 0);
            return { type: 'jobs', data: all.slice(0, 15), total };
          })
        );

        const searchResults = await Promise.all(promises);
        const newResults = { jobs: [] };
        const newCounts = { jobs: 0 };
        searchResults.forEach(r => {
          newResults[r.type] = r.data;
          newCounts[r.type] = r.total;
        });
        setResults(newResults);
        setCounts(newCounts);

        saveRecentSearch(query.trim());
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, filters]);

  const handleClick = (type, item) => {
    onClose();
    if (type === 'job') {
      if (item._isExternal) navigate(`/jobs?externalJobId=${item.id}`);
      else navigate(`/jobs?jobId=${item.id}`);
    }
  };

  const handleQuickAction = () => {
    onClose();
    navigate('/jobs');
  };

  const handleViewAll = () => {
    onClose();
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    navigate(`/jobs?${params.toString()}`);
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const ms = Date.now() - new Date(date).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  const renderLogo = (job) => {
    const logo = job.companyInfo?.logoUrl || job.recruiter?.recruiterProfile?.companyLogo;
    if (logo) return <img src={logo} alt="" />;
    const name = job.company || '';
    return name.charAt(0).toUpperCase() || <JobIcon fontSize="small" />;
  };

  return (
    <StyledDialog open={open} onClose={onClose} fullWidth TransitionProps={{ timeout: 150 }}>
      {/* ── Search Bar ── */}
      <SearchBar>
        <SearchIcon sx={{ color: '#999', fontSize: 22 }} />
        <SearchInputEl
          ref={inputRef}
          placeholder={'Search jobs\u2026'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) handleViewAll(); }}
        />
        {query && <ClearBtn onClick={() => setQuery('')}>Clear</ClearBtn>}
        <KbdButton onClick={onClose}>ESC</KbdButton>
      </SearchBar>

      {/* ── Tabs ── */}
      <TabsRow>
        <Tab $active onClick={() => setCategory('jobs')}>
          Jobs {counts.jobs > 0 && <TabCount>{counts.jobs}</TabCount>}
        </Tab>
      </TabsRow>

      {/* Filters intentionally removed, use the list page chips on /jobs to narrow results. */}

      {/* ── Content ── */}
      <Content>
        {!query.trim() ? (
          /* ── Empty State: Quick Actions + Recent + Trending ── */
          <>
            <div style={{ padding: '8px 20px 4px' }}>
              <SectionLabel>Quick Actions</SectionLabel>
            </div>
            <QuickActionRow onClick={() => handleQuickAction()}>
              <QAIcon $bg="#7C3AED"><JobIcon /></QAIcon>
              <Info>
                <Title>Browse Jobs</Title>
                <Sub>Find your next opportunity</Sub>
              </Info>
              <ArrowIcon sx={{ color: '#CCC' }} />
            </QuickActionRow>

            {(recentSearches.length > 0 || TRENDING.length > 0) && (
              <>
                <div style={{ height: 12 }} />
                <RecentTrendingRow>
                  {recentSearches.length > 0 && (
                    <RTColumn>
                      <RTLabel>Recent</RTLabel>
                      {recentSearches.map((s, i) => (
                        <RTItem key={i} onClick={() => setQuery(s)}>
                          <HistoryIcon sx={{ fontSize: 16, color: '#CCC' }} />
                          {s}
                        </RTItem>
                      ))}
                    </RTColumn>
                  )}
                  <RTColumn>
                    <RTLabel>Trending</RTLabel>
                    {TRENDING.map((t, i) => (
                      <RTItem key={i} onClick={() => setQuery(t.text)}>
                        <TrendingIcon sx={{ fontSize: 16, color: '#CCC' }} />
                        {t.text}
                        {t.hot && <HotBadge>HOT</HotBadge>}
                      </RTItem>
                    ))}
                  </RTColumn>
                </RecentTrendingRow>
              </>
            )}
          </>
        ) : loading ? (
          /* ── Skeleton Loading ── */
          <Section>
            <SectionLabel>Jobs</SectionLabel>
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </Section>
        ) : hasResults ? (
          /* ── Results ── */
          <>
            {/* Jobs */}
            {results.jobs.length > 0 && (
              <Section>
                <SectionLabel>
                  <JobIcon sx={{ fontSize: 14 }} />
                  Jobs
                  <span style={{ marginLeft: 4, color: '#BBB' }}>{counts.jobs} results</span>
                </SectionLabel>
                {results.jobs.map(job => (
                  <ResultRow key={`${job.id}-${job._isExternal ? 'ext' : 'plat'}`} onClick={() => handleClick('job', job)}>
                    <JobLogo>{renderLogo(job)}</JobLogo>
                    <Info>
                      <Title>{job.title}</Title>
                      <Sub>
                        {job.company || job.recruiter?.recruiterProfile?.companyName}
                        {job.location ? ` · ${job.location}` : ''}
                        {job.postedAt ? ` · ${getTimeAgo(job.postedAt)}` : ''}
                      </Sub>
                    </Info>
                    {job.matchScore && (
                      <MatchBadge $high={job.matchScore >= 80}>
                        <StarIcon sx={{ fontSize: 12, mr: 0.3, verticalAlign: -1 }} />
                        {job.matchScore >= 80 ? 'High Match' : 'Good Match'}
                      </MatchBadge>
                    )}
                    <Arrow className="arrow" />
                  </ResultRow>
                ))}
              </Section>
            )}

            {/* View All Button */}
            <ViewAllBtn onClick={handleViewAll}>
              View all {hasFilters ? 'filtered ' : ''}results for "{query}" →
            </ViewAllBtn>
          </>
        ) : (
          /* ── No Results ── */
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
            <SearchIcon sx={{ fontSize: 44, color: '#DDD', mb: 1 }} />
            <div style={{ fontWeight: 600, color: '#666' }}>No results found for "{query}"</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try different keywords or adjust your filters</div>
          </div>
        )}
      </Content>

      {/* ── Footer ── */}
      <Footer>
        <FooterItem><Kbd>↑↓</Kbd> navigate</FooterItem>
        <FooterItem><Kbd>↵</Kbd> select</FooterItem>
        <FooterItem><Kbd>Esc</Kbd> close</FooterItem>
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>✦ ProfilleAI</span>
      </Footer>
    </StyledDialog>
  );
};

export default GlobalSearchDialog;
