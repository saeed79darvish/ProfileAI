import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PACK_COVERED_FEATURES,
  FEATURE_LABELS,
  readUsage,
  formatReset,
} from '@/utils/aiLimit';

/**
 * Shown when the AI rate limiter returns 429 for a specific feature.
 *
 * Driven entirely by the limiter's payload, so the copy always names the real
 * feature, the real counts and the real reset date rather than a hardcoded
 * "you've hit your daily limit" that may not even be the window that was
 * enforced.
 *
 * Running out of credits is a purchase moment, so this replaces the inline red
 * error the AI flows used to show.
 */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.25s ease;
`;

const Header = styled.div`
  padding: 32px 28px 24px;
  background: linear-gradient(135deg, #eef2ff, #faf5ff);
  text-align: center;
`;

const IconCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.18);
`;

const Title = styled.h3`
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 800;
  color: #1a1a2e;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6b7280;
`;

const Body = styled.div`
  padding: 24px 28px 8px;
`;

const MeterWrap = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 18px;
`;

const MeterTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
`;

const MeterLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #374151;
`;

const MeterCount = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #dc2626;
`;

const MeterBar = styled.div`
  height: 8px;
  border-radius: 4px;
  background: #f3f4f6;
  overflow: hidden;
`;

const MeterFill = styled.div`
  height: 100%;
  border-radius: 4px;
  width: ${p => p.$pct}%;
  background: linear-gradient(90deg, #f87171, #dc2626);
`;

const ResetNote = styled.div`
  margin-top: 10px;
  font-size: 12.5px;
  color: #6b7280;
`;

const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Option = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 16px 18px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid ${p => p.$primary ? 'transparent' : '#e5e7eb'};
  background: ${p => p.$primary ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'white'};

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${p => p.$primary
      ? '0 6px 18px rgba(99, 102, 241, 0.35)'
      : '0 4px 12px rgba(0,0,0,0.06)'};
    border-color: ${p => p.$primary ? 'transparent' : '#d1d5db'};
  }

  .glyph {
    font-size: 22px;
    flex-shrink: 0;
  }

  .copy { flex: 1; min-width: 0; }

  .head {
    font-size: 15px;
    font-weight: 700;
    color: ${p => p.$primary ? 'white' : '#1a1a2e'};
  }

  .sub {
    font-size: 12.5px;
    margin-top: 2px;
    color: ${p => p.$primary ? 'rgba(255,255,255,0.85)' : '#6b7280'};
  }
`;

const Later = styled.button`
  width: 100%;
  margin: 16px 0 24px;
  padding: 12px;
  border: none;
  background: none;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;

  &:hover { background: #f9fafb; color: #374151; }
`;

const DismissBtn = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.7);
  color: #6b7280;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;

  &:hover { background: white; color: #1a1a2e; }
`;

export default function LimitReachedModal({ limit, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:768px)');

  if (!limit) return null;

  const label = FEATURE_LABELS[limit.featureType] || 'This feature';
  const { used, total, window } = readUsage(limit.usage);
  const resetOn = formatReset(limit.resetAt);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;

  // Only offer a purchase when a pack actually grants credits for this feature.
  const canBuyCredits = PACK_COVERED_FEATURES.has(limit.featureType);

  const go = (path) => {
    try {
      sessionStorage.setItem('upgradeReturnPath', location.pathname + location.search);
    } catch (_) { /* private mode */ }
    onClose?.();
    navigate(path);
  };

  return (
    <Dialog
      open={Boolean(limit)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 20, overflow: 'hidden' } }}
    >
      <Container>
        <DismissBtn onClick={onClose} aria-label="Close">×</DismissBtn>

        <Header>
          <IconCircle>⚡</IconCircle>
          <Title>You're out of {label} credits</Title>
          <Sub>{limit.message || `You've used all your ${label} credits.`}</Sub>
        </Header>

        <Body>
          {total > 0 && (
            <MeterWrap>
              <MeterTop>
                <MeterLabel>{label} used {window}</MeterLabel>
                <MeterCount>{used} of {total}</MeterCount>
              </MeterTop>
              <MeterBar><MeterFill $pct={pct} /></MeterBar>
              {resetOn && (
                <ResetNote>
                  Your free credits refresh on <strong>{resetOn}</strong>.
                </ResetNote>
              )}
            </MeterWrap>
          )}

          <OptionList>
            {limit.upgradeRequired && (
              <Option $primary onClick={() => go('/pricing')}>
                <span className="glyph">🚀</span>
                <span className="copy">
                  <span className="head">Upgrade your plan</span>
                  <span className="sub">Higher limits across every AI feature, billed monthly</span>
                </span>
              </Option>
            )}

            {canBuyCredits && (
              <Option onClick={() => go(limit.buyMoreUrl)}>
                <span className="glyph">🎟️</span>
                <span className="copy">
                  <span className="head">Buy {label} credits</span>
                  <span className="sub">A one-off pack for this feature, no subscription</span>
                </span>
              </Option>
            )}

            {!limit.upgradeRequired && !canBuyCredits && (
              <Option onClick={() => go('/pricing')}>
                <span className="glyph">📈</span>
                <span className="copy">
                  <span className="head">See your plan options</span>
                  <span className="sub">Compare limits and find one that fits your search</span>
                </span>
              </Option>
            )}
          </OptionList>

          <Later onClick={onClose}>
            {resetOn ? `Not now — I'll wait until ${resetOn}` : 'Not now'}
          </Later>
        </Body>
      </Container>
    </Dialog>
  );
}
