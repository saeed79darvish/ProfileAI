import styled from 'styled-components';

/* ================================================================
   LAYOUT
   ================================================================ */

export const PageContainer = styled.div`
  min-height: calc(100vh - 70px);
  background: #FAFAFB;
`;

export const SplitContainer = styled.div`
  display: grid;
  grid-template-columns: 400px 1fr 320px;
  height: calc(100vh - 70px);
  max-width: 1480px;
  margin: 0 auto;
  padding: 0;
  gap: 0;

  @media (max-width: 1200px) {
    grid-template-columns: 380px 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: 0;
    gap: 0;
  }
`;

export const LeftPanel = styled.div<{ $hideOnMobile?: boolean }>`
  background: white;
  overflow: visible;
  min-height: 0;
  border-right: 1px solid #EAECF0;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    border-right: none;
    display: ${props => props.$hideOnMobile ? 'none' : 'flex'};
  }
`;

export const RightPanel = styled.div`
  background: #FAFBFC;
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }
`;

export const SidebarPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  background: #FAFBFC;
  border-left: 1px solid #EAECF0;
  padding: 24px 20px;

  @media (max-width: 1200px) {
    display: none;
  }
`;

/* ================================================================
   SHARED
   ================================================================ */

export const Container = styled.div`
  padding: 20px 0 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 12px 0 0;
  }
`;

export const Header = styled.div`
  margin-bottom: 0;
  padding: 0 20px;
`;

export const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: #101828;
  margin-bottom: 2px;
  letter-spacing: -0.02em;
`;

export const Subtitle = styled.p`
  font-size: 13px;
  color: #667085;
  margin: 0;
`;

/* ================================================================
   SEARCH & FILTERS
   ================================================================ */

export const SearchSection = styled.div`
  margin-bottom: 8px;
  padding: 0 20px;
`;

export const SearchInputWrapper = styled.div`
  position: relative;
  margin-bottom: 12px;
`;

export const SearchInput = styled.input`
  width: 100%;
  padding: 11px 40px 11px 42px;
  border: 1px solid #D0D5DD;
  border-radius: 10px;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
  box-sizing: border-box;
  color: #101828;

  &:focus {
    outline: none;
    border-color: #7C3AED;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  &::placeholder {
    color: #98A2B3;
  }
`;

export const SearchIconWrapper = styled.div`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #98A2B3;

  svg { font-size: 20px; }
`;

export const SearchClearButton = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #98A2B3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.15s;

  &:hover {
    color: #344054;
    background: #F2F4F7;
  }

  svg { font-size: 18px; }
`;

export const FiltersRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 20px 14px;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export const FilterButtonsRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;

  /* Each chip wrapper (the relative-positioned div around FilterChip) and
     the Reset chip share the same flex behaviour: shrink to fit content,
     never stretch. This keeps the row stable when an active chip's label
     grows (e.g. "Date Posted · Past 24 hours"), it just wraps cleanly
     to the next line instead of pushing siblings around. */
  > div, > button {
    flex: 0 0 auto;
    min-width: 0;
  }

  @media (max-width: 768px) {
    /* Tighter chip padding + smaller gap on mobile so 4-5 chips fit per
       row instead of 2-3 — cuts the filter strip from 3 rows down to
       2 on most viewports. Dropdown content is portaled outside the row
       so it isn't clipped. */
    gap: 6px;

    > div > button, > button {
      padding: 6px 10px;
      font-size: 12px;
    }
  }
`;

export const FilterChip = styled.button<{ $active?: boolean; $variant?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.15s ease;
  /* Cap chip width so a long active label (e.g. "Date Posted · Past 24
     hours") doesn't blow out the row. The label inside ellipsises;
     the dropdown still shows the full value. */
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid;

  svg {
    font-size: 16px;
    opacity: 0.8;
    transition: transform 0.15s ease;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  ${(props) => {
    if (props.$active) {
      return `
        background: #7C3AED;
        border-color: #7C3AED;
        color: white;
        box-shadow: 0 1px 2px rgba(124,58,237,0.25);
        .dot { background: white; }
        &:hover { background: #6D28D9; border-color: #6D28D9; }
      `;
    }
    return `
      background: white;
      border-color: #E4E7EC;
      color: #475467;
      &:hover {
        border-color: #7C3AED;
        color: #7C3AED;
        background: #FAF5FF;
        svg { transform: translateY(1px); }
      }
    `;
  }}
`;

/* ================================================================
   TABS
   ================================================================ */

export const TabsContainer = styled.div`
  display: flex;
  gap: 4px;
  padding: 6px;
  margin: 0 20px 12px;
  background: #F2F4F7;
  border-radius: 12px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }

  @media (max-width: 768px) {
    margin: 0 12px 10px;
    padding: 4px;
    scroll-snap-type: x proximity;

    > button {
      flex: 0 0 auto;
      scroll-snap-align: start;
    }
  }
`;

export const Tab = styled.button<{ $active?: boolean }>`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.18s ease;
  background: ${props => props.$active ? 'white' : 'transparent'};
  color: ${props => props.$active ? '#101828' : '#667085'};
  border-radius: 8px;
  box-shadow: ${props => props.$active ? '0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.1)' : 'none'};
  white-space: nowrap;

  &:hover {
    color: ${props => props.$active ? '#101828' : '#344054'};
    background: ${props => props.$active ? 'white' : 'rgba(255,255,255,0.6)'};
  }

  /* Inline count badge, no more stacked numbers on narrow widths */
  span[data-count] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 999px;
    background: ${props => props.$active ? '#F4EBFF' : '#E4E7EC'};
    color: ${props => props.$active ? '#7C3AED' : '#667085'};
    line-height: 1;
  }
`;

/* ================================================================
   STATS (kept minimal)
   ================================================================ */

export const StatsRow = styled.div`
  display: none;
`;

export const StatCard = styled.div``;
export const StatInfo = styled.div``;
export const StatValue = styled.div``;
export const StatLabel = styled.div``;

/* ================================================================
   JOB CARDS
   ================================================================ */

export const JobsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;

  @media (max-width: 768px) {
    padding: 0 0 16px;
  }
`;

export const JobCard = styled.div<{ $selected?: boolean; $new?: boolean; $matchLevel?: string }>`
  padding: 16px 18px 16px 16px;
  cursor: pointer;
  transition: all 0.18s ease;
  border-radius: 14px;
  background: white;
  border: 1.5px solid ${props => props.$selected ? '#C4B5FD' : '#EEF0F3'};
  box-shadow: ${props => props.$selected
    ? '0 8px 24px -8px rgba(124,58,237,0.18), 0 2px 4px rgba(16,24,40,0.04)'
    : '0 1px 2px rgba(16,24,40,0.04)'};
  display: flex;
  gap: 14px;
  position: relative;

  /* Soft accent bar on the left for the selected card */
  &::before {
    content: '';
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: -1.5px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: ${props => props.$selected ? 'linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)' : 'transparent'};
    transition: background 0.18s ease;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: ${props => props.$selected ? '#A78BFA' : '#E4E7EC'};
    box-shadow: ${props => props.$selected
      ? '0 12px 28px -8px rgba(124,58,237,0.22), 0 2px 4px rgba(16,24,40,0.04)'
      : '0 4px 12px -4px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)'};
  }

  @media (max-width: 768px) {
    margin: 0 12px;
    flex-wrap: wrap;
    &::before { display: none; }
  }
`;

/* ================================================================
   SKELETON (card wrapper, inner shimmers use MUI <Skeleton />)
   ================================================================ */

export const JobCardSkeleton = styled.div`
  padding: 16px 18px 16px 16px;
  border-radius: 14px;
  background: white;
  border: 1.5px solid #EEF0F3;
  box-shadow: 0 1px 2px rgba(16,24,40,0.04);
  display: flex;
  gap: 14px;
  position: relative;

  @media (max-width: 768px) {
    margin: 0 12px;
  }
`;

export const SkeletonBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const SkeletonTagRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 2px;
`;

export const SkeletonFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
`;

export const JobHeader = styled.div``;

export const JobInfo = styled.div`
  flex: 1;
  min-width: 0;

  @media (max-width: 768px) {
    position: relative;
  }
`;

export const JobTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #101828;
  margin-bottom: 2px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Reserve space for the absolute-positioned SaveButton (32px) on the
     parent JobCard so the title's ellipsis appears before the bookmark
     icon, not under it. */
  padding-right: 36px;

  @media (max-width: 768px) {
    font-size: 16px;
    font-weight: 700;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    line-height: 1.3;
    margin-bottom: 4px;
    padding-right: 60px; /* space for match badge */
  }
`;

export const CompanyName = styled.div`
  font-size: 13px;
  color: #667085;
  margin-bottom: 8px;
  font-weight: 500;

  svg { display: none; }

  @media (max-width: 768px) {
    display: none;
  }
`;

export const Location = styled.div`
  display: none;
`;

export const SaveButton = styled.button<{ $saved?: boolean }>`
  background: ${props => props.$saved ? 'rgba(124, 58, 237, 0.08)' : 'transparent'};
  border: none;
  color: ${props => props.$saved ? '#7C3AED' : '#98A2B3'};
  cursor: pointer;
  padding: 6px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.18s ease;
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.1);
    transform: scale(1.05);
  }

  svg { font-size: 18px; }

  @media (max-width: 768px) {
    display: none;
  }
`;

export const JobTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;

  @media (max-width: 768px) {
    display: none;
  }
`;

export const Tag = styled.span<{ $variant?: string }>`
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #F2F4F7;
  color: #475467;

  svg { font-size: 12px; }

  ${(props) => {
    if (props.$variant === 'salary') return `
      background: #ECFDF3;
      color: #027A48;
      font-weight: 700;
    `;
    if (props.$variant === 'remote') return `
      background: #EEF4FF;
      color: #3538CD;
    `;
    return '';
  }}
`;

export const JobFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 768px) {
    display: none;
  }
`;

export const Salary = styled.div`
  display: none;
`;

export const PostedTime = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #98A2B3;

  svg { font-size: 14px; }
`;

export const MatchBadge = styled.span<{ $level?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px -2px rgba(124,58,237,0.2);
  }

  /* Mobile-only match badge: hidden on desktop, absolute top-right on mobile */
  &.mobile-match-badge {
    display: none;
    @media (max-width: 768px) {
      display: inline-flex;
      position: absolute;
      top: 0;
      right: 0;
      font-size: 13px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      z-index: 2;
    }
  }

  ${(props) => {
    if (props.$level === 'high') return `
      color: #5B21B6;
      background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
      border: 1px solid #DDD6FE;
    `;
    if (props.$level === 'good') return `
      color: #6941C6;
      background: #F4F3FF;
      border: 1px solid #E9D7FE;
    `;
    if (props.$level === 'applied') return `
      color: #027A48;
      background: #ECFDF3;
      border: 1px solid #A6F4C5;
    `;
    return `
      color: #475467;
      background: #F2F4F7;
      border: 1px solid #EAECF0;
    `;
  }}
`;

export const AgentButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #7C3AED;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: #6D28D9; }
  svg { font-size: 16px; }
`;

/* ================================================================
   LOADING / EMPTY
   ================================================================ */

export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  color: #98A2B3;
  font-size: 14px;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;

  svg {
    font-size: 48px;
    color: #D0D5DD;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #344054;
    margin-bottom: 6px;
  }

  p {
    color: #98A2B3;
    font-size: 14px;
  }
`;

/* ================================================================
   MOBILE
   ================================================================ */

export const MobileSelectedJobCard = styled.div<{ $show?: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: ${props => props.$show ? 'flex' : 'none'};
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 100;
    flex-direction: column;
    overflow: hidden;
  }
`;

export const MobileJobHeader = styled.div`
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: white;
    position: sticky;
    top: 0;
    z-index: 1000;
    border-bottom: 1px solid #EAECF0;
    gap: 12px;
  }
  @media (min-width: 769px) {
    display: none;
  }
`;

export const MobileHeaderTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  color: #101828;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MobileHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;

  button {
    background: none;
    border: none;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    color: #344054;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;

    &:hover { background: #F2F4F7; }
    svg { font-size: 22px; }
  }
`;

export const BackButton = styled.button`
  background: none;
  border: none;
  color: #344054;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover { background: #F2F4F7; }
  svg { font-size: 24px; }
`;

export const MobileJobContent = styled.div`
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0;
`;

/* ── Mobile Match Card (inline in job detail) ── */
export const MobileMatchCard = styled.div`
  margin: 16px 16px 0;
  padding: 16px;
  background: #F9FAFB;
  border-radius: 14px;
  border: 1px solid #EAECF0;
`;

export const MobileMatchHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
`;

export const MobileMatchRing = styled.div`
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
`;

export const MobileMatchInfo = styled.div`
  flex: 1;
`;

export const MobileMatchLabel = styled.div<{ $color?: string }>`
  font-size: 15px;
  font-weight: 700;
  color: ${props => props.$color || '#027A48'};
  margin-bottom: 2px;
`;

export const MobileMatchSub = styled.div`
  font-size: 12px;
  color: #667085;
  line-height: 1.4;
`;

export const MobileTailorBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #6941C6;
  background: #F4F3FF;
  padding: 2px 8px;
  border-radius: 6px;
  margin-left: 8px;
`;

export const MobileMatchButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

export const MobileMatchBtn = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;

  ${props => props.$primary ? `
    background: #7C3AED;
    color: white;
    border: none;
    &:hover { background: #6D28D9; }
    &:active { transform: scale(0.97); }
  ` : `
    background: white;
    color: #344054;
    border: 1px solid #D0D5DD;
    &:hover { background: #F9FAFB; }
    &:active { transform: scale(0.97); }
  `}

  svg { font-size: 16px; }
`;

/* ── Mobile AI Tool Cards (horizontal scroll) ── */
export const MobileAIToolsScroll = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 12px 16px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
`;

export const MobileAIToolCard = styled.button<{ $color?: string }>`
  flex-shrink: 0;
  width: 130px;
  padding: 14px 12px;
  background: ${props => props.$color || '#F9FAFB'};
  border: 1px solid #EAECF0;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;

  &:active { transform: scale(0.96); }

  .tool-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    svg { font-size: 16px; color: #7C3AED; }
  }

  .tool-title {
    font-size: 13px;
    font-weight: 600;
    color: #101828;
    margin-bottom: 2px;
  }

  .tool-desc {
    font-size: 11px;
    color: #667085;
    line-height: 1.3;
  }
`;

/* ── Mobile Sticky Footer ── */
export const MobileStickyFooter = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #EAECF0;
    position: sticky;
    bottom: 0;
    z-index: 101;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
  }
`;

export const MobileFooterBookmark = styled.button<{ $saved?: boolean }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid #D0D5DD;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  color: ${props => props.$saved ? '#7C3AED' : '#667085'};

  &:active { transform: scale(0.95); }
  svg { font-size: 22px; }
`;

export const MobileFooterApply = styled.button`
  flex: 1;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #D0D5DD;
  background: white;
  font-size: 15px;
  font-weight: 700;
  color: #344054;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:active { transform: scale(0.97); }
  svg { font-size: 16px; }
`;

export const MobileFooterTailor = styled.button`
  flex: 1;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  background: #7C3AED;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover { background: #6D28D9; }
  &:active { transform: scale(0.97); }
  svg { font-size: 16px; }
`;

/* ── Mobile Job Card Enhancements ── */
export const MobileCardMeta = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
    font-size: 14px;
    color: #667085;
    margin-bottom: 10px;

    .meta-sep {
      margin: 0 6px;
      color: #D0D5DD;
    }

    .meta-salary {
      color: #027A48;
      font-weight: 600;
    }
  }
`;

export const MobileCardSkills = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 0;
  }
`;

export const MobileSkillDot = styled.span<{ $matched?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => props.$matched ? '#F0FDF4' : '#F2F4F7'};
  color: ${props => props.$matched ? '#15803D' : '#475467'};
  border: 1px solid ${props => props.$matched ? '#BBF7D0' : '#EAECF0'};

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${props => props.$matched ? '#22C55E' : '#98A2B3'};
  }
`;

export const MobileCardActions = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #F2F4F7;
  }
`;

export const MobileCardActionLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #98A2B3;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .meta-sep {
    color: #D0D5DD;
    flex-shrink: 0;
  }

  svg { font-size: 14px; flex-shrink: 0; }
`;

export const MobileCardActionRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const MobileCardBtn = styled.button<{ $variant?: string }>`
  background: none;
  border: none;
  padding: 8px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: #667085;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  ${props => props.$variant === 'tailor' ? `
    padding: 8px 14px;
    background: #F9F5FF;
    color: #7C3AED;
    font-size: 13px;
    font-weight: 600;
    gap: 5px;
    border-radius: 10px;
    border: 1px solid #E9D5FF;
    min-width: auto;
  ` : ''}

  &:hover { background: #F2F4F7; }
  &:active { transform: scale(0.93); }
  svg { font-size: 18px; }
`;

/* ── Mobile Section Group Headers ── */
export const MobileSectionHeader = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 6px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475467;
  }
`;

export const MobileSectionDot = styled.span<{ $color?: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$color || '#10B981'};
`;

export const MobileMoreOpportunities = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: block;
    padding: 0 16px;
  }
`;

export const MobileMoreHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

export const MobileMoreTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #101828;
  margin: 0;
`;

export const MobileViewAll = styled.button`
  background: none;
  border: none;
  color: #7C3AED;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

export const MobileJobsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const MobileJobItem = styled.div`
  background: #F9FAFB;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    transform: scale(0.98);
    background: #F2F4F7;
  }
`;

export const MobileJobIcon = styled.div<{ $color?: string }>`
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: ${props => props.$color || '#7C3AED'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  svg { font-size: 24px; color: white; }
`;

export const MobileJobInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const MobileJobTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #101828;
  margin-bottom: 4px;
`;

export const MobileJobCompany = styled.div`
  font-size: 13px;
  color: #667085;
  margin-bottom: 6px;
`;

export const MobileJobMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #98A2B3;
  flex-wrap: wrap;
`;

export const MobileJobTime = styled.div`
  font-size: 11px;
  color: #98A2B3;
  text-align: right;
  flex-shrink: 0;
`;

/* ================================================================
   SIDEBAR SECTIONS
   ================================================================ */

export const SidebarCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #EAECF0;
  margin-bottom: 16px;
`;

export const SidebarTitle = styled.h3`
  font-size: 13px;
  font-weight: 700;
  color: #667085;
  margin: 0 0 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const SkillChip = styled.span`
  display: inline-flex;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #344054;
  background: #F2F4F7;
  border: 1px solid #EAECF0;
`;

export const CompanyInfoRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;

  &:not(:last-child) {
    border-bottom: 1px solid #F2F4F7;
  }

  .icon-circle {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #F2F4F7;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    svg { font-size: 16px; color: #667085; }
  }

  .info-content {
    flex: 1;
    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: #98A2B3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 13px;
      font-weight: 500;
      color: #101828;
    }
    a {
      font-size: 13px;
      font-weight: 500;
      color: #7C3AED;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  }
`;

export const SimilarRoleCard = styled.div`
  padding: 12px 14px;
  border-radius: 10px;
  background: #F9FAFB;
  cursor: pointer;
  transition: all 0.12s ease;
  border: 1px solid transparent;

  &:hover {
    background: #F2F4F7;
    border-color: #EAECF0;
  }

  &:not(:last-child) { margin-bottom: 8px; }

  .similar-title {
    font-size: 13px;
    font-weight: 600;
    color: #101828;
    margin-bottom: 3px;
  }

  .similar-meta {
    font-size: 12px;
    color: #667085;
  }
`;

/* ================================================================
   DETAIL PANEL (ExternalJobDescriptionStyles)
   ================================================================ */

export const ExternalJobDescriptionStyles = styled.div`
  height: 100%;
  -webkit-font-smoothing: antialiased;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  .job-detail-scroll {
    height: 100%;
    overflow-y: auto;
  }

  /* --- Breadcrumb --- */
  .job-detail-breadcrumb {
    padding: 20px 32px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    @media (max-width: 768px) { padding: 12px 16px 0; }
  }

  .breadcrumb-links {
    font-size: 13px;
    color: #98A2B3;

    a, span {
      color: #667085;
      text-decoration: none;
      &:hover { color: #7C3AED; }
    }

    .breadcrumb-sep {
      margin: 0 8px;
      color: #D0D5DD;
    }

    .breadcrumb-current {
      color: #101828;
      font-weight: 600;
    }
  }

  .breadcrumb-actions {
    display: flex;
    gap: 4px;

    button {
      background: none;
      border: none;
      color: #98A2B3;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: all 0.15s;
      &:hover { color: #7C3AED; background: #F9F5FF; }
      svg { font-size: 18px; }
    }
  }

  /* --- Header --- */
  .job-detail-header {
    padding: 24px 32px 0;
    @media (max-width: 768px) { padding: 16px 16px 0; }
  }

  .job-detail-hero {
    display: flex;
    gap: 18px;
    margin-bottom: 20px;
    @media (max-width: 768px) { gap: 12px; }
  }

  .job-detail-hero-info {
    flex: 1;
    min-width: 0;
  }

  .job-detail-title {
    font-size: 24px;
    font-weight: 700;
    color: #101828;
    margin: 0 0 6px;
    line-height: 1.25;
    letter-spacing: -0.02em;
    @media (max-width: 768px) { font-size: 20px; }
  }

  .job-detail-company-line {
    font-size: 15px;
    color: #667085;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
  }

  .job-detail-company-name {
    font-weight: 600;
    color: #344054;
  }

  .job-detail-location {
    color: #667085;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    svg { font-size: 16px; color: #98A2B3; }
  }

  .job-detail-meta {
    font-size: 13px;
    color: #98A2B3;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .job-detail-source-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .job-detail-source-badge.greenhouse { color: #057642; background: rgba(5,118,66,0.08); }
  .job-detail-source-badge.lever { color: #0A66C2; background: rgba(10,102,194,0.08); }
  .job-detail-source-badge.remoteok { color: #1a1a2e; background: rgba(26,26,46,0.08); }
  .job-detail-source-badge.adzuna { color: #D4451A; background: rgba(212,69,26,0.08); }
  .job-detail-source-badge.jsearch { color: #4285F4; background: rgba(66,133,244,0.08); }
  .job-detail-source-badge.theirstack { color: #6C3FC5; background: rgba(108,63,197,0.08); }
  .job-detail-source-badge.ashby { color: #6D28D9; background: rgba(109,40,217,0.08); }
  .job-detail-source-badge.wwr { color: #ef4444; background: rgba(239,68,68,0.08); }

  /* --- Info Chips --- */
  .job-detail-info-cards {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .job-detail-info-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #344054;
    background: #F2F4F7;
    border: 1px solid #EAECF0;

    svg { font-size: 15px; color: #667085; }
    @media (max-width: 768px) { padding: 5px 10px; font-size: 12px; }
  }

  .job-detail-info-chip.salary {
    color: #027A48;
    background: #ECFDF3;
    border-color: #A6F4C5;
    font-weight: 600;
    svg { color: #027A48; }
  }

  /* --- Action Buttons --- */
  .job-detail-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    align-items: center;
  }

  .job-detail-apply-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    background: #7C3AED;
    color: white;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    font-size: 15px;
    border: none;
    cursor: pointer;
    transition: all 0.15s;

    svg { font-size: 18px; }

    &:hover {
      background: #6D28D9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(124,58,237,0.3);
    }
  }

  .job-detail-auto-apply-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 20px;
    background: white;
    color: #7C3AED;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid #7C3AED;
    cursor: pointer;
    transition: all 0.15s;

    svg { font-size: 18px; }

    &:hover {
      background: #F9F5FF;
    }
  }

  .job-detail-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 11px 18px;
    background: white;
    color: #667085;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid #D0D5DD;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      border-color: #7C3AED;
      color: #7C3AED;
      background: #F9F5FF;
    }
  }

  /* --- AI Match Card --- */
  .ai-match-card {
    background: linear-gradient(135deg, #7C3AED 0%, #6366F1 100%);
    border-radius: 16px;
    padding: 24px 28px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -40px;
      right: -40px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }
  }

  .ai-match-content {
    flex: 1;
    color: white;
  }

  .ai-match-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 8px;
    color: white;

    svg { font-size: 18px; }
  }

  .ai-match-desc {
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255,255,255,0.85);
    margin-bottom: 12px;
  }

  .ai-match-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ai-match-tag {
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255,255,255,0.18);
    color: white;
    backdrop-filter: blur(4px);
  }

  .ai-match-circle {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 3px solid rgba(255,255,255,0.3);

    .match-pct {
      font-size: 22px;
      font-weight: 800;
      color: white;
    }
  }

  /* --- Match badge (inline small) --- */
  .job-detail-match-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .job-detail-match-badge.high {
    background: #F4F3FF;
    color: #6941C6;
    border: 1px solid #D9D6FE;
  }

  .job-detail-match-badge.medium {
    background: #F9F5FF;
    color: #7C3AED;
    border: 1px solid #E9D5FF;
  }

  .job-detail-match-badge.low {
    background: #F2F4F7;
    color: #667085;
    border: 1px solid #EAECF0;
  }

  /* --- AI Tools --- */
  .job-detail-ai-tools {
    background: #F9F5FF;
    border: 1px solid #E9D5FF;
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 24px;
  }

  .job-detail-ai-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .job-detail-ai-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: linear-gradient(135deg, #7C3AED, #6366F1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    svg { font-size: 16px; color: white; }
  }

  .job-detail-ai-title {
    font-size: 14px;
    font-weight: 700;
    color: #101828;
  }

  .job-detail-ai-subtitle {
    font-size: 11px;
    color: #98A2B3;
    letter-spacing: 0.02em;
  }

  .job-detail-ai-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .job-detail-ai-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 8px;
    background: white;
    border: 1px solid #EAECF0;
    font-size: 13px;
    font-weight: 600;
    color: #344054;
    cursor: pointer;
    transition: all 0.15s;

    svg { font-size: 15px; }

    &:hover {
      border-color: #7C3AED;
      color: #7C3AED;
      background: white;
    }
  }

  .job-detail-ai-btn.primary {
    background: #7C3AED;
    border: none;
    color: white;

    &:hover {
      background: #6D28D9;
      color: white;
    }
  }

  /* --- Divider --- */
  .job-detail-divider {
    height: 1px;
    background: #EAECF0;
    margin: 0 32px;
  }

  /* --- Body --- */
  .job-detail-body {
    padding: 24px 32px 56px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    @media (max-width: 768px) { padding: 16px 16px 40px; gap: 16px; }
  }

  .job-detail-section-card {
    background: white;
    border: 1px solid #EAECF0;
    border-radius: 12px;
    padding: 24px 28px;
    @media (max-width: 768px) { padding: 20px 16px; border-radius: 10px; }
  }

  .job-detail-section-title {
    font-size: 18px;
    font-weight: 700;
    color: #101828;
    margin: 0 0 16px;
    letter-spacing: -0.01em;
    line-height: 1.3;
    display: flex;
    align-items: center;
    gap: 12px;

    .section-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #F2F4F7;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 18px;
    }
  }

  .job-detail-section-title.sub {
    font-size: 18px;
    margin: 0 0 16px;
    padding-top: 0;
    border-top: none;
  }

  /* "What you'll do" bullets */
  .job-detail-checklist {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .job-detail-checklist li {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    font-size: 14px;
    line-height: 1.65;
    color: #344054;
    align-items: flex-start;

    .check-icon {
      color: #7C3AED;
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  /* Skills tags (in detail) */
  .job-detail-skills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 0;
  }

  .job-detail-skill-tag {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    background: #F2F4F7;
    color: #344054;
    border: 1px solid #EAECF0;
  }

  /* --- Empty State --- */
  .job-detail-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #D0D5DD;
    padding: 40px;
    text-align: center;

    svg {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 600;
      color: #667085;
      margin-bottom: 4px;
    }

    .empty-subtitle {
      font-size: 13px;
      color: #98A2B3;
    }
  }

  /* ===== Rich HTML ===== */
  .external-job-description {
    font-size: 15px;
    line-height: 1.75;
    color: #344054;
    word-break: break-word;

    h1, h2, h3, h4, h5, h6 {
      color: #101828;
      font-weight: 700;
      margin: 24px 0 10px;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }
    h1 { font-size: 20px; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; }
    h4 { font-size: 15px; }

    p { margin: 0 0 12px; }

    ul, ol {
      margin: 6px 0 14px;
      padding-left: 0;
      list-style: none;
    }

    li {
      margin-bottom: 4px;
      padding-left: 28px;
      line-height: 1.65;
      position: relative;
    }

    li::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 6px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #F2F4F7;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237C3AED'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
      background-size: 10px;
      background-repeat: no-repeat;
      background-position: center;
    }

    li::marker { display: none; }

    strong, b {
      font-weight: 700;
      color: #101828;
    }

    a {
      color: #7C3AED;
      text-decoration: none;
      font-weight: 500;
      &:hover { text-decoration: underline; }
    }

    blockquote {
      border-left: 3px solid #EAECF0;
      padding: 8px 20px;
      margin: 16px 0;
      color: #667085;
      font-style: italic;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      th, td {
        padding: 8px 12px;
        border: 1px solid #EAECF0;
        text-align: left;
        font-size: 13px;
      }
      th {
        background: #F9FAFB;
        font-weight: 600;
        color: #101828;
      }
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    hr {
      border: none;
      border-top: 1px solid #EAECF0;
      margin: 24px 0;
    }

    > *:first-child { margin-top: 0; }
  }
`;

/* ══════════════════════════════════════════════
   Mobile Job Detail, Redesign (mockup)
   ══════════════════════════════════════════════ */

export const MobileDetailCompanyRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px 0;

  .company-logo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #F2F4F7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    color: #6941C6;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid #EAECF0;
    img { width: 100%; height: 100%; object-fit: cover; }
  }

  .company-info {
    flex: 1;
    min-width: 0;
  }

  .company-name {
    font-size: 16px;
    font-weight: 700;
    color: #101828;
  }

  .company-meta {
    font-size: 13px;
    color: #667085;
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 2px;
    svg { font-size: 15px; }
  }
`;

export const MobileDetailTitle = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #101828;
  margin: 14px 16px 0;
  line-height: 1.25;
`;

export const MobileDetailTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px 0;
`;

export const MobileDetailTag = styled.span<{ $salary?: boolean; $source?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  background: ${p => p.$salary ? '#ECFDF3' : '#F2F4F7'};
  color: ${p => p.$salary ? '#027A48' : '#344054'};
  border: 1px solid ${p => p.$salary ? '#D1FADF' : '#EAECF0'};

  ${p => p.$source && `
    background: white;
    color: #667085;
    font-size: 12px;
  `}
`;

/* Match Card - redesigned with expandable gap */
export const MobileMatchCardV2 = styled.div`
  margin: 16px;
  padding: 20px;
  background: #FFFBF5;
  border-radius: 16px;
  border: 1px solid #F2E8D8;
`;

export const MobileMatchTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

export const MobileMatchRingV2 = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
`;

export const MobileMatchDetails = styled.div`
  flex: 1;

  .match-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .match-label {
    font-size: 18px;
    font-weight: 800;
    color: #101828;
  }

  .tailor-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: #027A48;
    background: #ECFDF3;
    padding: 3px 10px;
    border-radius: 6px;
  }

  .match-sub {
    font-size: 14px;
    color: #667085;
    line-height: 1.45;

    strong { color: #101828; font-weight: 700; }
  }
`;

export const MobileGapDivider = styled.div`
  border-top: 1px dashed #D0D5DD;
  margin: 14px 0 0;
`;

export const MobileGapToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 0 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #6941C6;

  svg {
    font-size: 20px;
    transition: transform 0.2s;
  }

  &[data-open='true'] svg {
    transform: rotate(180deg);
  }
`;

export const MobileGapList = styled.div<{ $open?: boolean }>`
  display: ${p => p.$open ? 'block' : 'none'};
  margin-top: 12px;
`;

export const MobileGapItem = styled.div<{ $met?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  font-size: 16px;
  color: #1D2939;
  line-height: 1.5;

  .gap-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 7px;
    background: ${p => p.$met ? '#12B76A' : '#F04438'};
  }

  .gap-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    background: #FEE4E2;
    color: #D92D20;
    margin-left: auto;
    flex-shrink: 0;
    white-space: nowrap;
    margin-top: 2px;
  }
`;

/* About the role */
export const MobileSection = styled.div`
  padding: 24px 16px 0;
  border-top: 1px solid #EAECF0;
  margin-top: 8px;
`;

export const MobileSectionTitle = styled.h3`
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #101828;
  margin: 0 0 14px;
`;

export const MobileSectionBody = styled.div<{ $collapsed?: boolean }>`
  font-size: 15px;
  color: #344054;
  line-height: 1.7;
  ${p => p.$collapsed && `
    max-height: 200px;
    overflow: hidden;
    position: relative;
    -webkit-mask-image: linear-gradient(180deg, black calc(100% - 32px), transparent 100%);
    mask-image: linear-gradient(180deg, black calc(100% - 32px), transparent 100%);
  `}

  .external-job-description {
    font-size: 14px;
    line-height: 1.55;
    color: #344054;
    white-space: pre-line;

    h1, h2, h3, h4, h5, h6 { font-size: 15px; margin: 12px 0 4px; font-weight: 700; white-space: normal; }
    ul, ol { padding-left: 20px; margin: 6px 0; list-style: disc; white-space: normal; }
    li { margin: 3px 0; line-height: 1.5; }
    p { margin: 6px 0; }
    strong { font-weight: 700; }
  }
`;

export const MobileReadMore = styled.button`
  background: none;
  border: none;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #6941C6;
  cursor: pointer;
`;

/* Skills for this Role */
export const MobileSkillsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  .skills-count {
    font-size: 13px;
    font-weight: 500;
    color: #667085;
  }
`;

export const MobileSkillGroup = styled.div`
  margin-bottom: 16px;
`;

export const MobileSkillGroupLabel = styled.div<{ $missing?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #1D2939;

  .group-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${p => p.$missing ? '#F04438' : '#12B76A'};
    flex-shrink: 0;
  }

  .group-count {
    font-weight: 500;
    color: #667085;
    font-size: 14px;
  }
`;

export const MobileSkillChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const MobileSkillChip = styled.span<{ $missing?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: default;
  border: 1.5px solid ${p => p.$missing ? '#FDA29B' : '#A6F4C5'};
  background: ${p => p.$missing ? '#FFF4F3' : '#F0FDF4'};
  color: ${p => p.$missing ? '#B42318' : '#027A48'};
`;

/* Benefits */
export const MobileBenefitsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
`;

export const MobileBenefitChip = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #F9FAFB;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #344054;

  svg { font-size: 20px; color: #667085; }
`;

/* Similar Jobs */
export const MobileSimilarScroll = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  scroll-snap-type: x mandatory;
  scroll-padding-left: 4px;
  position: relative;
  -webkit-mask-image: linear-gradient(90deg, black calc(100% - 32px), transparent 100%);
  mask-image: linear-gradient(90deg, black calc(100% - 32px), transparent 100%);
  &::-webkit-scrollbar { display: none; }

  > * {
    scroll-snap-align: start;
  }
`;

export const MobileSimilarCard = styled.button`
  flex-shrink: 0;
  width: 240px;
  padding: 16px;
  background: white;
  border: 1px solid #EAECF0;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;

  &:active { transform: scale(0.97); }

  .similar-company {
    font-size: 13px;
    font-weight: 600;
    color: #667085;
    margin-bottom: 4px;
  }

  .similar-title {
    font-size: 15px;
    font-weight: 700;
    color: #101828;
    margin-bottom: 10px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.35;
  }

  .similar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
  }

  .similar-match {
    font-weight: 700;
    color: #6941C6;
  }

  .similar-meta {
    color: #667085;
  }
`;

/* Sticky Footer - Two rows */
export const MobileStickyFooterV2 = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    background: white;
    border-top: 1px solid #EAECF0;
    position: sticky;
    bottom: 0;
    z-index: 101;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.06);
  }
`;

export const MobileFooterToolsRow = styled.div`
  display: flex;
  gap: 8px;
`;

export const MobileFooterToolBtn = styled.button<{ $pro?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid #D0D5DD;
  background: white;
  font-size: 13px;
  font-weight: 600;
  color: #344054;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:active { transform: scale(0.97); background: #F9FAFB; }
  svg { font-size: 16px; color: #667085; }

  .pro-badge {
    font-size: 10px;
    font-weight: 700;
    color: #6941C6;
    background: #F4F3FF;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 2px;
  }
`;

export const MobileFooterActionsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: stretch;
`;

export const MobileFooterTailorV2 = styled.button`
  padding: 14px 16px;
  border-radius: 14px;
  border: none;
  background: #7C3AED;
  font-size: 15px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s;
  line-height: 1.25;

  &:hover { background: #6D28D9; }
  &:active { transform: scale(0.97); }
  svg { font-size: 18px; flex-shrink: 0; }
`;
