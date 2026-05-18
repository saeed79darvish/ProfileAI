import styled, { css, keyframes } from 'styled-components';

/* ─── Layout ─── */
export const PageContainer = styled.div`
  display: flex;
  height: calc(100vh - 64px);
  background: #f5f6fa;
  overflow: hidden;
`;

/* ─── Left Sidebar ─── */
export const Sidebar = styled.aside<{ $hidden?: boolean }>`
  width: 380px;
  min-width: 380px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e8ecf1;
  overflow: hidden;

  @media (max-width: 900px) {
    width: 100%;
    min-width: 100%;
    display: ${({ $hidden }) => ($hidden ? 'none' : 'flex')};
  }
`;

export const SidebarHeader = styled.div`
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e8ecf1;
`;

export const SidebarTitle = styled.h2`
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
`;

export const SearchBox = styled.div`
  position: relative;
`;

export const SearchInput = styled.input`
  width: 100%;
  padding: 10px 14px 10px 40px;
  border: 1px solid #e8ecf1;
  border-radius: 12px;
  font-size: 14px;
  background: #f5f6fa;
  color: #1a1a2e;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;

  &::placeholder { color: #9ca3af; }
  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: #fff;
  }
`;

export const SearchIcon = styled.span`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  display: flex;
  font-size: 18px;
`;

/* ─── Tabs ─── */
export const TabBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  border-bottom: 1px solid #e8ecf1;
  overflow-x: auto;
  &::-webkit-scrollbar { display: none; }
`;

export const TabItem = styled.button<{ $active?: boolean }>`
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;

  ${({ $active }) =>
    $active
      ? css`
          background: #667eea;
          color: #fff;
        `
      : css`
          background: #f0f1f5;
          color: #6b7280;
          &:hover { background: #e5e7eb; }
        `}
`;

export const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  background: #ef4444;
  color: #fff;
`;

/* ─── Conversation List ─── */
export const ConversationList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

export const ConversationItem = styled.div<{ $active?: boolean; $unread?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;

  ${({ $active }) =>
    $active
      ? css`
          background: rgba(102, 126, 234, 0.1);
          border-left: 3px solid #667eea;
        `
      : css`
          border-left: 3px solid transparent;
          &:hover { background: #f9fafb; }
        `}
`;

export const ConvAvatar = styled.div<{ $color?: string }>`
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
  background: ${({ $color }) => $color || '#667eea'};
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const OnlineDot = styled.span`
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #fff;
`;

export const ConvInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ConvTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
`;

export const ConvName = styled.span<{ $unread?: boolean }>`
  font-size: 14px;
  font-weight: ${({ $unread }) => ($unread ? 700 : 500)};
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ConvTime = styled.span<{ $unread?: boolean }>`
  font-size: 12px;
  color: ${({ $unread }) => ($unread ? '#667eea' : '#9ca3af')};
  font-weight: ${({ $unread }) => ($unread ? 600 : 400)};
  white-space: nowrap;
  margin-left: 8px;
`;

export const ConvPreview = styled.div<{ $unread?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const ConvPreviewText = styled.span<{ $unread?: boolean }>`
  font-size: 13px;
  color: ${({ $unread }) => ($unread ? '#374151' : '#9ca3af')};
  font-weight: ${({ $unread }) => ($unread ? 500 : 400)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

export const UnreadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  background: #667eea;
  color: #fff;
  flex-shrink: 0;
`;

export const ConvMenuBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  opacity: 0;
  transition: opacity 0.15s;

  ${ConversationItem}:hover & { opacity: 0.6; }
  &:hover { opacity: 1 !important; background: rgba(0,0,0,0.04); }
`;

/* ─── Empty States ─── */
export const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
`;

export const EmptyIcon = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(102, 126, 234, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  font-size: 48px;
  color: #667eea;
`;

export const EmptyTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
`;

export const EmptySubtitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: #9ca3af;
  max-width: 300px;
`;

/* ─── Right Chat Panel ─── */
export const ChatPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  min-width: 0;

  @media (max-width: 900px) {
    display: flex;
  }
`;

export const ChatHeader = styled.div`
  padding: 12px 20px;
  border-bottom: 1px solid #e8ecf1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
`;

export const ChatHeaderInfo = styled.div`
  flex: 1;
  cursor: pointer;
`;

export const ChatHeaderName = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
`;

export const ChatHeaderStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #9ca3af;
`;

export const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
`;

export const ChatHeaderActions = styled.div`
  display: flex;
  gap: 4px;
`;

export const HeaderActionBtn = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f5f6fa;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  font-size: 18px;

  &:hover { background: #e5e7eb; color: #1a1a2e; }
  &.active { background: rgba(102, 126, 234, 0.1); color: #667eea; }
`;

/* ─── Interview Banner ─── */
export const InterviewBanner = styled.div`
  padding: 10px 20px;
  background: rgba(102, 126, 234, 0.08);
  border-bottom: 1px solid #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const BannerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #667eea;
`;

export const BannerBtn = styled.button`
  padding: 6px 14px;
  border: 1px solid #667eea;
  border-radius: 8px;
  background: transparent;
  color: #667eea;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { background: rgba(102, 126, 234, 0.08); }
`;

/* ─── Messages Area ─── */
export const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8f9fb;
`;

export const DateDivider = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
`;

export const DateLabel = styled.span`
  padding: 4px 14px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
`;

export const MessageRow = styled.div<{ $mine?: boolean }>`
  display: flex;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 6px;
`;

export const MessageAvatar = styled.div`
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #667eea;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const BubbleWrapper = styled.div`
  max-width: 65%;
`;

export const Bubble = styled.div<{ $mine?: boolean; $reschedule?: boolean }>`
  padding: 10px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;

  ${({ $mine, $reschedule }) => {
    if ($reschedule) {
      return css`
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
      `;
    }
    if ($mine) {
      return css`
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border-top-right-radius: 4px;
      `;
    }
    return css`
      background: #fff;
      color: #1a1a2e;
      border: 1px solid #e8ecf1;
      border-top-left-radius: 4px;
    `;
  }}
`;

export const MessageMeta = styled.div<{ $mine?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  gap: 4px;
  margin-top: 4px;
  padding: 0 4px;
`;

export const MessageTime = styled.span`
  font-size: 11px;
  color: #9ca3af;
`;

export const DeliveryIcon = styled.span<{ $read?: boolean }>`
  font-size: 14px;
  color: ${({ $read }) => ($read ? '#22c55e' : '#9ca3af')};
  display: flex;
`;

/* ─── Message Input ─── */
export const InputArea = styled.div`
  padding: 16px 20px;
  border-top: 1px solid #e8ecf1;
  background: #fff;
`;

export const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #f5f6fa;
  border-radius: 16px;
  padding: 6px 8px 6px 16px;
  border: 1px solid transparent;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #667eea;
    background: #fff;
  }
`;

export const MessageInput = styled.textarea`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #1a1a2e;
  resize: none;
  outline: none;
  min-height: 24px;
  max-height: 120px;
  line-height: 1.5;
  font-family: inherit;
  padding: 6px 0;

  &::placeholder { color: #9ca3af; }
`;

export const InputIconBtn = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
  flex-shrink: 0;
  font-size: 18px;

  &:hover { color: #667eea; }
`;

export const SendButton = styled.button<{ $disabled?: boolean }>`
  padding: 8px 18px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  flex-shrink: 0;

  ${({ $disabled }) =>
    $disabled
      ? css`
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
        `
      : css`
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          &:hover { opacity: 0.9; transform: translateY(-1px); }
        `}
`;

/* ─── Profile Panel ─── */
export const ProfileSidebar = styled.aside`
  width: 300px;
  min-width: 300px;
  border-left: 1px solid #e8ecf1;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

export const ProfileHeader = styled.div`
  padding: 24px;
  text-align: center;
  border-bottom: 1px solid #e8ecf1;
`;

export const ProfileAvatar = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 12px;
  border: 3px solid #667eea;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  background: #667eea;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const ProfileName = styled.h4`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  cursor: pointer;
  &:hover { color: #667eea; }
`;

export const ProfileHeadline = styled.p`
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
`;

export const ProfileSection = styled.div`
  padding: 16px;
`;

export const ProfileSectionTitle = styled.h5`
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
`;

export const ProfileInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #6b7280;

  svg { font-size: 16px; color: #9ca3af; }
`;

export const ProfileDangerBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;

  &:hover { background: rgba(239, 68, 68, 0.08); }
`;

/* ─── Mobile Back Button ─── */
export const BackButton = styled.button`
  display: none;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f5f6fa;
  color: #6b7280;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  font-size: 20px;

  @media (max-width: 900px) {
    display: flex;
  }
`;

/* ─── Loading ─── */
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid #e8ecf1;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

export const LoadingContainer = styled.div`
  height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6fa;
`;

/* ─── Interview Request Button (inside bubble) ─── */
export const InterviewActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: #667eea;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #5a6fd6; }
`;

/* ─── Error Alert ─── */
export const ErrorAlert = styled.div`
  margin: 0 16px 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
`;
