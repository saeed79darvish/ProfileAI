import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const slideUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ─── Styled Components ──────────────────────
export const PageContainer = styled.div`
  min-height: calc(100vh - 70px);
  background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
  padding: 0;
`;

export const Header = styled.div`
  background: linear-gradient(135deg, #0d0219 0%, #1a0533 60%, #2d1b69 100%);
  padding: 32px 40px 24px;
  color: white;

  @media (max-width: 768px) {
    padding: 20px 16px 16px;
  }
`;

export const HeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    margin-bottom: 12px;
  }
`;

export const HeaderTitle = styled.div`
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 6px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  p {
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    h1 { font-size: 1.35rem; }
    p { font-size: 0.8rem; }
  }
`;

export const StatsRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 8px;
    width: 100%;
  }
`;

export const StatPill = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;

  .value {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    line-height: 1;
  }
  .label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media (max-width: 768px) {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    .value { font-size: 1.1rem; }
    .label { font-size: 0.6rem; }
  }
`;

export const ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 8px;
  }
`;

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 0 12px;
  flex: 1;
  max-width: 320px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #667eea;
  }

  input {
    background: none;
    border: none;
    color: white;
    font-size: 0.85rem;
    padding: 10px 8px;
    width: 100%;
    outline: none;
    &::placeholder { color: rgba(255, 255, 255, 0.35); }
  }
  svg { color: rgba(255, 255, 255, 0.35); font-size: 1.1rem; }

  @media (max-width: 768px) {
    max-width: 100%;
    flex: 1 1 100%;
    order: 3;
  }
`;

export const ViewToggle = styled.div`
  display: flex;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  overflow: hidden;
`;

export const ViewBtn = styled.button`
  background: ${p => (p.$active ? 'rgba(102, 126, 234, 0.35)' : 'transparent')};
  color: ${p => (p.$active ? 'white' : 'rgba(255,255,255,0.4)')};
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  transition: all 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.12); color: white; }
`;

export const FilterBtn = styled.button`
  background: ${p => (p.$active ? 'rgba(102, 126, 234, 0.35)' : 'rgba(255,255,255,0.08)')};
  color: ${p => (p.$active ? 'white' : 'rgba(255,255,255,0.5)')};
  border: 1px solid ${p => (p.$active ? '#667eea' : 'rgba(255,255,255,0.12)')};
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  transition: all 0.2s;
  &:hover { border-color: #667eea; color: white; }
`;

export const AddButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(102,126,234,0.4); }
`;

// ─── Kanban Board ────────────────────────────
export const KanbanContainer = styled.div`
  display: flex;
  gap: 16px;
  padding: 24px 40px;
  overflow-x: auto;
  min-height: calc(100vh - 250px);
  
  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

  @media (max-width: 768px) {
    padding: 16px;
    gap: 12px;
  }
`;

export const KanbanColumn = styled.div`
  min-width: 280px;
  max-width: 320px;
  flex: 1;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.4s ease-out;
  animation-delay: ${p => p.$delay || '0s'};
  animation-fill-mode: backwards;

  @media (max-width: 768px) {
    min-width: 260px;
  }
`;

export const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
`;

export const ColumnTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;

  .emoji { font-size: 1rem; }
  .count {
    background: ${p => p.$color || '#667eea'};
    color: white;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
  }
`;

export const ColumnBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.04);
  min-height: 120px;
`;

export const EmptyColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #94a3b8;
  font-size: 0.8rem;
  text-align: center;
  .emoji { font-size: 1.5rem; margin-bottom: 8px; }
`;

// ─── Application Card ────────────────────────
export const AppCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f1f5f9;
  animation: ${slideUp} 0.3s ease-out;
  animation-delay: ${p => p.$delay || '0s'};
  animation-fill-mode: backwards;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    border-color: ${p => p.$accentColor || '#667eea'}33;
  }
`;

export const CardCompany = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`;

export const CompanyAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${p => p.$bg || '#eef0ff'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: ${p => p.$color || '#667eea'};
  flex-shrink: 0;
`;

export const CompanyInfo = styled.div`
  flex: 1;
  min-width: 0;
  .name {
    font-weight: 600;
    font-size: 0.85rem;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    font-size: 0.75rem;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

export const MetaTag = styled.span`
  font-size: 0.68rem;
  color: #64748b;
  background: #f8fafc;
  padding: 3px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;

  svg { font-size: 0.75rem; }
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
`;

export const DateLabel = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
`;

export const MatchBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${p => (p.$score >= 80 ? '#10b981' : p.$score >= 60 ? '#f59e0b' : '#94a3b8')};
  background: ${p => (p.$score >= 80 ? '#d1fae5' : p.$score >= 60 ? '#fef3c7' : '#f9fafb')};
  padding: 2px 8px;
  border-radius: 6px;
`;

// ─── List View ────────────────────────────
export const ListView = styled.div`
  padding: 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: 768px) {
    padding: 16px;
    gap: 6px;
  }
`;

export const ListRow = styled.div`
  background: white;
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;
  animation: ${slideUp} 0.3s ease-out;
  animation-delay: ${p => p.$delay || '0s'};
  animation-fill-mode: backwards;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    border-color: #667eea33;
  }

  @media (max-width: 768px) {
    flex-wrap: wrap;
    padding: 12px;
    gap: 8px;
  }
`;

export const ListCompany = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 2;
  min-width: 0;

  .details {
    min-width: 0;
    .company { font-weight: 600; font-size: 0.85rem; color: #1e293b; }
    .title { font-size: 0.78rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }
`;

export const ListMeta = styled.div`
  flex: 1;
  font-size: 0.78rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

export const ListStatus = styled.div`
  flex: 0 0 auto;
`;

export const ListDate = styled.div`
  flex: 0 0 auto;
  font-size: 0.75rem;
  color: #94a3b8;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

export const ListActions = styled.div`
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
`;

export const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  color: ${p => p.$color};
  background: ${p => p.$bg};
`;

// ─── Empty State ────────────────────────────
export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  animation: ${fadeIn} 0.5s ease-out;
`;

export const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 16px;
`;

export const EmptyTitle = styled.h2`
  font-size: 1.3rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
`;

export const EmptyText = styled.p`
  color: #64748b;
  font-size: 0.9rem;
  max-width: 400px;
  margin: 0 0 24px;
  line-height: 1.5;
`;

export const CTAButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 28px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
`;

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
`;

// ─── Archive Section ─────────────────────────
export const ArchiveSection = styled.div`
  padding: 0 40px 40px;
  @media (max-width: 768px) { padding: 0 16px 24px; }
`;

export const ArchiveToggle = styled.button`
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  margin-top: 12px;
  &:hover { color: #1e293b; }
  svg { transition: transform 0.2s; transform: rotate(${p => (p.$open ? '180deg' : '0deg')}); }
`;

export const ArchiveCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 12px;
  opacity: ${p => (p.$open ? 1 : 0)};
  max-height: ${p => (p.$open ? '2000px' : '0')};
  overflow: hidden;
  transition: all 0.3s ease;
`;
