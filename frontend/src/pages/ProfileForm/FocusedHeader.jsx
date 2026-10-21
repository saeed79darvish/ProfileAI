import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import BrandLogo from '@/components/BrandLogo';

/* Stands in for the global Navbar on /profile/create-form (App.jsx hides it
   there). The marketing nav (Pricing, Extension, Sign In, Get Started)
   competed with Save while someone was building their first profile; this
   keeps only what the task needs: where you are, how far along, and Save.
   Heights match the Navbar (64px, 56px on mobile) so the sticky offsets the
   editor's toolbar and section pills were tuned for still line up. */
const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 24px;

  @media (max-width: 768px) {
    height: 56px;
    padding: 0 16px;
  }
`;

const Inner = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
`;

const LogoLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;

  /* The wordmark is the first thing to go when space runs out; the icon
     alone still reads as "home". */
  @media (max-width: 480px) {
    .wordmark-wrap > span:last-child { display: none; }
  }
`;

const Progress = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 320px;
  margin-left: auto;

  .track {
    flex: 1;
    min-width: 40px;
    height: 6px;
    border-radius: 999px;
    background: #eef2ff;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s ease;
  }
  .pct {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    white-space: nowrap;
  }
  .label {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;

    @media (max-width: 640px) { display: none; }
  }
`;

const BackLink = styled(Link)`
  font-size: 13px;
  font-weight: 600;
  color: #4f46e5;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover { text-decoration: underline; }

  @media (max-width: 640px) { display: none; }
`;

const SaveButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  cursor: pointer;

  svg { font-size: 18px; }

  &:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
  }
`;

const FocusedHeader = ({
  isAuthenticated,
  hasSavedProfile,
  completion,
  onSave,
  saving,
  saveDisabled,
}) => (
  <Bar>
    <Inner>
      {/* Signed-in people have already converted, so "home" for them is the
          dashboard, the same rule the global Navbar's logo follows. */}
      <LogoLink to={isAuthenticated ? '/profile' : '/'} aria-label="profilleai home">
        <BrandLogo className="wordmark-wrap" iconSize={28} fontSize="1.2rem" />
      </LogoLink>
      <Progress aria-label={`Profile ${completion.pct}% complete`}>
        <div className="track">
          <div className="fill" style={{ width: `${completion.pct}%` }} />
        </div>
        <span className="pct">{completion.pct}%</span>
        <span className="label">{completion.label}</span>
      </Progress>
      {/* Someone editing a profile they already saved still needs a way out
          that is not Save; without the Navbar this is it. */}
      {hasSavedProfile && <BackLink to="/profile">Back to my profile</BackLink>}
      <SaveButton type="button" onClick={onSave} disabled={saveDisabled || saving}>
        {saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        {saving ? 'Saving...' : 'Save'}
      </SaveButton>
    </Inner>
  </Bar>
);

export default FocusedHeader;
