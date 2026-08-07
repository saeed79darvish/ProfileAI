import React, { useState, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_LABELS, readUsage, formatReset, daysUntil } from '@/utils/aiLimit';
import {
  currentPlanFor,
  nextPlanFor,
  planHighlights,
  packsFor,
  packEconomics,
  promoFor,
} from '@/config/plans';
import PaymentMethodSelector from './PaymentMethodSelector';

/**
 * Shown when the AI rate limiter returns 429.
 *
 * Everything is derived from the limiter's payload plus the user's current
 * tier: which plan to pitch, what the new limits would be, whether credit
 * packs can even unblock this feature. No hardcoded prices or counts — a user
 * reading "30 enhancements a month, up from 2" is reading the limits the
 * limiter will actually enforce.
 */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Wrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.25s ease;
  background: #fff;
`;

const Head = styled.div`padding: 22px 26px 0;`;

const PlanChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  background: #f1f2f6;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #4b5563;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9ca3af;
  }
`;

const Title = styled.h3`
  margin: 12px 0 12px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #0f1020;
  line-height: 1.15;
`;

const MeterTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 14px;
  color: #6b7280;

  strong { color: #0f1020; font-weight: 800; }
  .reset { font-size: 13px; font-weight: 600; color: #6b7280; text-align: right; }
`;

const Meter = styled.div`
  height: 7px;
  border-radius: 4px;
  background: #eceef3;
  overflow: hidden;
  margin: 10px 0 0;
`;

const MeterFill = styled.div`
  height: 100%;
  width: ${p => p.$pct}%;
  border-radius: 4px;
  background: linear-gradient(90deg, #5b4fe0, #7c3aed);
`;

const Tabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 16px 26px 0;
  padding: 5px;
  border-radius: 14px;
  background: #eeeef5;
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 10px;
  border-radius: 9px;
  border: ${p => p.$active ? '2px solid #3b6fe0' : '2px solid transparent'};
  background: ${p => p.$active ? '#fff' : 'transparent'};
  font-size: 15px;
  font-weight: 700;
  color: ${p => p.$active ? '#0f1020' : '#4b5563'};
  cursor: pointer;
  transition: all 0.18s;

  &:hover { color: #0f1020; }
`;

const BestValue = styled.span`
  padding: 3px 8px;
  border-radius: 6px;
  background: #dcfce7;
  color: #15803d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
`;

const Body = styled.div`padding: 14px 26px 0;`;

const PlanCard = styled.div`
  position: relative;
  border-radius: 16px;
  padding: 18px 22px;
  background: linear-gradient(150deg, #6b5ce0, #8b5cf6);
  color: white;
  overflow: hidden;
`;

const PopularTag = styled.span`
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.4px;
`;

const FromLabel = styled.div`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
`;

const PlanName = styled.div`
  font-size: 26px;
  font-weight: 800;
  margin-top: 2px;
  letter-spacing: -0.5px;
`;

// Two columns on desktop so the price and the benefits sit side by side; the
// card was tall and narrow when everything stacked.
const PlanGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 22px;
  align-items: center;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 14px;
  }
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;

  .amount { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
  .per { font-size: 15px; color: rgba(255, 255, 255, 0.82); }
  .was {
    font-size: 17px;
    color: rgba(255, 255, 255, 0.6);
    text-decoration: line-through;
    margin-left: 2px;
  }
`;

const Benefits = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0 0 0 22px;
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: 600px) {
    padding: 13px 0 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.22);
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    font-size: 14.5px;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.92);
  }

  .tick { font-weight: 800; flex-shrink: 0; }
  strong { color: #fff; font-weight: 800; }
`;

const CrossLink = styled.div`
  text-align: center;
  margin: 12px 0 0;
  font-size: 13.5px;
  color: #6b7280;

  button {
    border: none;
    background: none;
    padding: 0;
    font-size: 14px;
    font-weight: 800;
    color: #5b4fe0;
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }
`;

const PackRow = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 13px 16px;
  margin-bottom: 8px;
  border-radius: 14px;
  cursor: pointer;
  background: ${p => p.$sel ? '#fbfaff' : '#fff'};
  border: 2px solid ${p => p.$sel ? '#5b4fe0' : '#e8eaef'};
  transition: all 0.18s;

  &:hover { border-color: ${p => p.$sel ? '#5b4fe0' : '#cfd4dd'}; }
`;

const Radio = styled.span`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid ${p => p.$sel ? '#5b4fe0' : '#cbd0d9'};
  display: grid;
  place-items: center;

  &::after {
    content: '';
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: ${p => p.$sel ? '#5b4fe0' : 'transparent'};
  }
`;

const PackInfo = styled.div`
  flex: 1;
  min-width: 0;

  .n { font-size: 18px; font-weight: 800; color: #0f1020; }
  .per { font-size: 13.5px; color: #6b7280; margin-top: 3px; display: flex; align-items: center; gap: 8px; }
`;

const SaveTag = styled.span`
  padding: 3px 8px;
  border-radius: 6px;
  background: #dcfce7;
  color: #15803d;
  font-size: 11px;
  font-weight: 800;
`;

const PackPrice = styled.div`
  font-size: 21px;
  font-weight: 800;
  color: #0f1020;
  flex-shrink: 0;
`;

const PopularPill = styled.span`
  position: absolute;
  top: -11px;
  right: 14px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #5b4fe0;
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.4px;
`;

const Foot = styled.div`
  margin-top: 14px;
  padding: 14px 26px 18px;
  border-top: 1px solid #eef0f4;
`;

const Nudge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 11px 14px;
  border-radius: 10px;
  background: #fdf6e7;
  color: #92400e;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 11px;
`;

const Cta = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #5b4fe0, #8b5cf6);
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(91, 79, 224, 0.4); }
`;

const FootRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 11px;

  .assure { display: flex; align-items: center; gap: 7px; font-size: 13.5px; color: #4b5563; }
  .tick { color: #16a34a; font-weight: 800; }
`;

const Later = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 14px;
  font-weight: 700;
  color: #6b7280;
  cursor: pointer;
  &:hover { color: #0f1020; }
`;

const Close = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: none;
  color: #9ca3af;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  &:hover { background: #f3f4f6; color: #0f1020; }
`;

const money = (n) => `$${n.toFixed(2)}`;

export default function LimitReachedModal({ limit, onClose, promo = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth() || {};
  const isMobile = useMediaQuery('(max-width:768px)');

  const tier = user?.subscriptionTier || 'free';
  const current = currentPlanFor(tier);
  const target = nextPlanFor(tier);
  const feature = limit?.featureType;
  const packs = useMemo(() => packsFor(feature), [feature]);

  const [tab, setTab] = useState('plan');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selected, setSelected] = useState(() => {
    const p = packsFor(feature);
    return (p.find((x) => x.popular) || p[0])?.id || null;
  });

  if (!limit) return null;

  const label = FEATURE_LABELS[feature] || 'AI';
  const { used, total } = readUsage(limit.usage);
  const resetOn = formatReset(limit.resetAt);
  const inDays = daysUntil(limit.resetAt);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;

  // Only offer the packs tab when a pack actually grants credits for the
  // feature that was blocked. Selling a tailoring pack to someone who ran out
  // of enhancements would take their money without unblocking them.
  const canBuy = packs.length > 0;
  const showPlan = Boolean(target);
  const activeTab = !canBuy ? 'plan' : !showPlan ? 'credits' : tab;

  const pack = packs.find((p) => p.id === selected) || packs[0];
  const highlights = target ? planHighlights(target, current, feature) : [];
  // Promo from config, unless the caller passes one explicitly.
  const offer = promo || (target ? promoFor(target) : null);
  const payNow = offer ? offer.price : target?.price ?? 0;

  const go = (path) => {
    try {
      sessionStorage.setItem('upgradeReturnPath', location.pathname + location.search);
    } catch (_) { /* private mode */ }
    onClose?.();
    navigate(path);
  };

  // The plan was chosen here, so the payment step opens here too — bouncing to
  // /pricing made the user watch a page load only to be shown the same choice
  // again. Stripe still takes over from the method picker, so the return
  // breadcrumb is written exactly as the redirect used to write it.
  const openCheckout = () => {
    if (!target) return go('/pricing');
    try {
      sessionStorage.setItem('upgradeReturnPath', location.pathname + location.search);
    } catch (_) { /* private mode */ }
    setCheckoutOpen(true);
  };

  // PaymentMethodSelector speaks the /pricing page's plan shape. `type` is the
  // only field that reaches the checkout API; the rest is display. Billing is
  // monthly because that's the number the CTA below quotes — opening an annual
  // checkout under a monthly price would be a bait and switch.
  const checkoutPlan = target && {
    type: target.id,
    name: target.label,
    price: { monthly: target.price, yearly: 0 },
  };

  const headline = showPlan
    ? `Keep ${label.toLowerCase() === 'profile enhancement' ? 'enhancing your profile' : `using ${label}`}`
    : `You're out of ${label} credits`;

  return (
    <>
    <Dialog
      open={Boolean(limit)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 24, overflow: 'hidden' } }}
    >
      <Wrap>
        <Close onClick={onClose} aria-label="Close">×</Close>

        <Head>
          <PlanChip>{current.label}</PlanChip>
          <Title>{headline}</Title>
          <MeterTop>
            <span><strong>{used} of {total}</strong> credits used</span>
            {resetOn && (
              <span className="reset">
                Resets {resetOn}{inDays !== null ? `, in ${inDays} days` : ''}
              </span>
            )}
          </MeterTop>
          <Meter><MeterFill $pct={pct} /></Meter>
        </Head>

        {showPlan && canBuy && (
          <Tabs>
            <Tab $active={activeTab === 'plan'} onClick={() => setTab('plan')}>
              Upgrade plan <BestValue>BEST VALUE</BestValue>
            </Tab>
            <Tab $active={activeTab === 'credits'} onClick={() => setTab('credits')}>
              Buy credits
            </Tab>
          </Tabs>
        )}

        <Body>
          {activeTab === 'plan' && target && (
            <>
              <PlanCard>
                {target.popular && <PopularTag>MOST POPULAR</PopularTag>}
                <PlanGrid>
                  <div>
                    <FromLabel>Upgrade from {current.label}</FromLabel>
                    <PlanName>{target.label}</PlanName>
                    <PriceRow>
                      <span className="amount">{money(payNow)}</span>
                      <span className="per">{offer ? '/mo first month' : '/mo'}</span>
                      {offer && <span className="was">{money(offer.was)}</span>}
                    </PriceRow>
                  </div>
                  <Benefits>
                    {highlights.map((h, i) => (
                      <li key={i}>
                        <span className="tick">✓</span>
                        <span>{h.strong ? <strong>{h.strong}</strong> : null}{h.rest}</span>
                      </li>
                    ))}
                  </Benefits>
                </PlanGrid>
              </PlanCard>

              <CrossLink>
                {canBuy ? (
                  <>Just need a few this month?{' '}
                    <button onClick={() => setTab('credits')}>Buy a credit pack</button></>
                ) : (
                  <button onClick={() => go('/pricing')}>Compare all plans</button>
                )}
              </CrossLink>
            </>
          )}

          {activeTab === 'credits' && canBuy && (
            <>
              {packs.map((p) => {
                const { per, savePct } = packEconomics(p, packs);
                const sel = pack?.id === p.id;
                return (
                  <PackRow key={p.id} $sel={sel} onClick={() => setSelected(p.id)}>
                    {p.popular && <PopularPill>MOST POPULAR</PopularPill>}
                    <Radio $sel={sel} />
                    <PackInfo>
                      <div className="n">{p.credits} credits</div>
                      <div className="per">
                        {money(per)} per credit
                        {savePct > 0 && <SaveTag>SAVE {savePct}%</SaveTag>}
                      </div>
                    </PackInfo>
                    <PackPrice>{money(p.price)}</PackPrice>
                  </PackRow>
                );
              })}
              <CrossLink>
                Credits never expire.{' '}
                <button onClick={() => (showPlan ? setTab('plan') : go('/pricing'))}>
                  Compare with a plan
                </button>
              </CrossLink>
            </>
          )}
        </Body>

        <Foot>
          {activeTab === 'plan' && offer?.banner && <Nudge>🕐 {offer.banner}</Nudge>}
          {activeTab === 'credits' && showPlan && (
            <Nudge>🕐 {target.label} gives you more credits for less each month</Nudge>
          )}

          {activeTab === 'plan' && target ? (
            <Cta onClick={openCheckout}>
              ⚡ Upgrade to {target.label} for {money(payNow)}
            </Cta>
          ) : pack ? (
            <Cta onClick={() => go(`/pricing?pack=${pack.id}&checkout=1#credit-packs`)}>
              ⚡ Buy {pack.credits} credits for {money(pack.price)}
            </Cta>
          ) : (
            <Cta onClick={() => go('/pricing')}>⚡ See plan options</Cta>
          )}

          <FootRow>
            <span className="assure">
              <span className="tick">✓</span>
              {activeTab === 'plan'
                ? 'Cancel anytime. Instant access.'
                : 'One time charge. Credits never expire.'}
            </span>
            <Later onClick={onClose}>Maybe later</Later>
          </FootRow>
        </Foot>
      </Wrap>
    </Dialog>

    {/* Stacked over this modal rather than replacing it, so closing the picker
        drops the user back on the plan they were considering — and on the
        credits tab they can still fall back to. */}
    {checkoutPlan && (
      <PaymentMethodSelector
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={checkoutPlan}
        billingCycle="monthly"
      />
    )}
    </>
  );
}
