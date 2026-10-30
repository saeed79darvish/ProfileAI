import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { ChatBubbleOutline as ChatIcon } from '@mui/icons-material';
import { unfinishedConversation } from '@/pages/ProfileCoach/coachLogic';
import { trackEvent } from '@/utils/analytics';

/**
 * "Finish your profile with the coach", for someone who saved partway
 * through the coach and landed here.
 *
 * The coach told them they could finish later, and the conversation is
 * still saved in this browser, but nothing on the profile said so: the way
 * back was knowing to open /profile/create. Shown only while an unfinished
 * conversation is saved (it lasts a day); the coach then offers to pick it
 * up where they stopped.
 */

const TEXT = {
  TITLE: 'Finish your profile with the coach',
  BODY: 'You saved partway through. Pick up where you stopped: the rest of the questions make your profile, and the jobs matched to it, sharper.',
  GO: 'Finish with the coach',
  LATER: 'Not now',
};

const FinishCoachCard = () => {
  const navigate = useNavigate();
  // Read once: the saved conversation does not change while this page is up.
  const [saved] = useState(() => unfinishedConversation());
  const [hidden, setHidden] = useState(false);
  if (!saved || hidden) return null;

  const go = () => {
    trackEvent('coach_finish_card_clicked', {});
    navigate('/profile/create');
  };

  return (
    <Card aria-labelledby="finish-coach-title">
      <Icon aria-hidden="true"><ChatIcon /></Icon>
      <div className="body">
        <h3 id="finish-coach-title">{TEXT.TITLE}</h3>
        <p>{TEXT.BODY}</p>
      </div>
      <div className="actions">
        <button type="button" className="primary" onClick={go}>{TEXT.GO}</button>
        <button type="button" className="secondary" onClick={() => setHidden(true)}>{TEXT.LATER}</button>
      </div>
    </Card>
  );
};

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Card = styled.section`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid #c9cbf8;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(14, 165, 233, 0.06)), #fff;
  box-shadow: 0 4px 18px rgba(79, 70, 229, 0.1);
  animation: ${slideDown} 0.4s ease;

  .body { flex: 1; min-width: 0; }

  h3 {
    margin: 0 0 4px;
    font-size: 1.02rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
    color: #5b5b76;
  }

  .actions { display: flex; gap: 8px; flex: none; }

  button {
    border: none;
    border-radius: 12px;
    padding: 10px 16px;
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .primary { background: #6366f1; color: #fff; }
  .primary:hover { background: #5457e5; }
  .secondary { background: transparent; color: #5b5b76; }

  @media (max-width: 640px) {
    flex-wrap: wrap;
    .actions { width: 100%; }
    .primary { flex: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Icon = styled.span`
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #6366f1;
  color: #fff;

  svg { width: 22px; height: 22px; }
`;

export default FinishCoachCard;
