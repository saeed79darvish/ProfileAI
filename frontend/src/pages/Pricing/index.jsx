import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ElectricBolt as BoltIcon,
  Star as StarIcon,
  AutoAwesome as AutoAwesomeIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
  CardGiftcard as GiftIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, useMediaQuery } from '@mui/material';
import {
  PageContainer,
  Header,
  SpecialBadge,
  Title,
  Subtitle,
  BillingToggle,
  BillingOption,
  SaveBadge,
  PlansSection,
  PlansGrid,
  PlanCard,
  PopularBadge,
  PlanIcon,
  PlanName,
  PlanDescription,
  PriceRow,
  Price,
  PricePeriod,
  BilledText,
  PlanButton,
  FeaturesList,
  FeatureItem,
  CompareSection,
  PromoButton,
  SectionTitle,
  CompareTable,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableCell,
  FAQSection,
  FAQItem,
  FAQQuestion,
  FAQAnswer,
  CTASection,
  CTATitle,
  CTASubtitle,
  CTAButtons,
  CTAButton,
  CreditPacksSection,
  CreditPacksGrid,
  CreditPackCard,
  PackBadge,
  PackName,
  PackDescription,
  PackPrice,
  PackPerCredit,
  PackButton,
  AddOnGrid,
  AddOnCard,
  AddOnIcon,
  AddOnInfo,
  AddOnName,
  AddOnDesc,
  AddOnPrice,
  Snackbar,
  CreditPacksSubtitle,
  AddOnSectionHeader,
  dialogPaperSx,
  dialogTitleSx,
  promoIconBoxSx,
  giftIconSx
} from './styled';
import { getPrice, renderFeatureValue } from './utils';
import { ROUTES, TEXT, CREDIT_PACKS, COMPARE_FEATURES, FAQS, TIMINGS } from './constants';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import { creditPackAPI } from '../../services/api';
import styled from 'styled-components';

// ─── Mobile-only UI primitives ────────────────────────────────────────────
// Kept inline (not in styled.ts) because they're scoped to the mobile
// branch of this page only — moving them out would force all readers to
// jump files to understand the disclosure / tab pattern.

const PlanTabsMobile = styled.div`
  display: flex;
  gap: 6px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  margin: 0 auto 20px;
  max-width: 360px;
`;

const PlanTabMobile = styled.button`
  flex: 1;
  position: relative;
  padding: 10px 12px;
  border: none;
  border-radius: 9px;
  background: ${(p) => (p.$active ? '#fff' : 'transparent')};
  color: ${(p) => (p.$active ? '#0f172a' : '#64748b')};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(15, 23, 42, 0.10)' : 'none')};
  &:hover { color: #0f172a; }
`;

const PlanTabDot = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7c3aed;
  margin-left: 6px;
  vertical-align: middle;
`;

const DisclosureToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  margin: 0 0 8px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover { border-color: #7c3aed; background: rgba(124, 58, 237, 0.03); }
`;

const DisclosureChevron = styled.span`
  display: inline-block;
  font-size: 16px;
  color: #64748b;
  transition: transform 0.2s ease;
  transform: ${(p) => (p.$open ? 'rotate(180deg)' : 'rotate(0)')};
`;

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [snackbar, setSnackbar] = useState({ show: false, message: '', type: 'info' });
  const [openFAQ, setOpenFAQ] = useState(null);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(null);
  // Mobile-specific UX: tabs over stacked cards, and disclosure-style
  // wrappers for Compare / Credit Packs to cut scrolling from ~5 viewports
  // down to ~2. Desktop is untouched.
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activePlanTab, setActivePlanTab] = useState('pro'); // default to the Most Popular tier
  const [compareOpenMobile, setCompareOpenMobile] = useState(false);
  const [creditPacksOpenMobile, setCreditPacksOpenMobile] = useState(false);

  // Handle purchase success/cancel from Stripe redirect
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    if (purchaseStatus === 'success') {
      const packName = searchParams.get('pack');
      setSnackbar({ show: true, message: `Credit pack purchased successfully!${packName ? ` (${packName})` : ''}`, type: 'success' });
      setTimeout(() => setSnackbar(prev => ({ ...prev, show: false })), 4000);
    } else if (purchaseStatus === 'cancelled') {
      setSnackbar({ show: true, message: 'Purchase cancelled.', type: 'info' });
      setTimeout(() => setSnackbar(prev => ({ ...prev, show: false })), 3000);
    }
  }, [searchParams]);

  // Three-tier candidate plan: Free is a trial, Pro is the main plan,
  // Pro+ is the power user / hands-off auto-apply tier.
  const plans = [
    {
      name: 'Free',
      type: 'free',
      icon: <BoltIcon />,
      price: { monthly: 0, yearly: 0 },
      description: 'Try every feature, no card needed',
      popular: false,
      buttonText: 'Get Started Free',
      features: [
        '3 Resume Tailorings (lifetime trial)',
        '1 Resume Parse / month',
        '1 Profile Enhancement / month',
        '2 AI Cover Letters / month',
        '5 Career Suggestions / month',
        'Basic Profile & Community Access'
      ]
    },
    {
      name: 'Pro',
      type: 'pro',
      icon: <StarIcon />,
      price: { monthly: 14.99, yearly: 119.00 },
      description: 'For active job seekers',
      popular: true,
      buttonText: 'Upgrade to Pro',
      features: [
        '50 Resume Tailorings / month',
        '30 AI Cover Letters / month',
        '20 Resume Parses / month',
        '30 Profile Enhancements / month',
        'Unlimited Career Suggestions',
        'Watermark-free Exports',
        'Advanced Analytics + Priority Support'
      ]
    },
    {
      name: 'Pro+',
      type: 'pro_plus',
      icon: <AutoAwesomeIcon />,
      price: { monthly: 29.99, yearly: 239.00 },
      description: 'Hands-off auto-apply with ApplyPilot',
      popular: false,
      buttonText: 'Upgrade to Pro+',
      features: [
        'Everything in Pro, plus:',
        'ApplyPilot Auto-Apply (30/week)',
        '200 Resume Tailorings / month',
        '200 AI Cover Letters / month',
        'Unlimited Interview Prep',
        'Batch Tailoring',
        'Unlimited Profile Views'
      ]
    }
  ];

  const handleSubscribe = (plan) => {
    if (!user) {
      navigate('/register');
      return;
    }

    if (plan.type === 'free') {
      setSnackbar({
        show: true,
        message: 'You already have access to the free tier!',
        type: 'info'
      });
      setTimeout(() => setSnackbar(prev => ({ ...prev, show: false })), 3000);
      return;
    }

    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const handleBuyPack = async (packId) => {
    if (!user) {
      navigate('/register');
      return;
    }

    setPurchaseLoading(packId);
    try {
      const { data } = await creditPackAPI.purchase(packId);
      
      if (data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        // Dev mode - instant grant
        setSnackbar({
          show: true,
          message: data.message || 'Credits added to your account!',
          type: 'success'
        });
        setTimeout(() => setSnackbar(prev => ({ ...prev, show: false })), 3000);
      }
    } catch (error) {
      setSnackbar({
        show: true,
        message: error.response?.data?.error || 'Failed to purchase. Please try again.',
        type: 'error'
      });
      setTimeout(() => setSnackbar(prev => ({ ...prev, show: false })), 3000);
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleCheckoutSuccess = () => {
    setSnackbar({
      show: true,
      message: 'Successfully subscribed! Redirecting...',
      type: 'success'
    });

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };



  return (
    <PageContainer>
      <ScrollToTop />
      <PromoButton onClick={() => setPromoModalOpen(true)}>
        <span className="icon"><GiftIcon /></span>
        Have a Promo Code?
      </PromoButton>

      {/* Header */}
      <Header>
        <SpecialBadge>
          <BoltIcon /> {TEXT.LAUNCH_BADGE}
        </SpecialBadge>
        <Title>{TEXT.TITLE}</Title>
        <Subtitle>{TEXT.SUBTITLE}</Subtitle>

        <BillingToggle>
          <BillingOption
            $active={billingCycle === 'monthly'}
            onClick={() => setBillingCycle('monthly')}
          >
            {TEXT.MONTHLY}
          </BillingOption>
          <BillingOption
            $active={billingCycle === 'yearly'}
            onClick={() => setBillingCycle('yearly')}
          >
            {TEXT.ANNUAL}
            <SaveBadge>{TEXT.SAVE_BADGE}</SaveBadge>
          </BillingOption>
        </BillingToggle>
      </Header>

      {/* Subscription Plans
          Desktop: 3 cards side by side (PlansGrid handles the layout).
          Mobile:  Tab bar to pick one plan; only that plan's card is rendered.
                   This trades "3 stacked cards = 3 viewports of scroll" for
                   "1 viewport with a tab switcher". */}
      <PlansSection>
        {isMobile && (
          <PlanTabsMobile>
            {plans.map((p) => (
              <PlanTabMobile
                key={p.type}
                $active={activePlanTab === p.type}
                $popular={p.popular}
                onClick={() => setActivePlanTab(p.type)}
                type="button"
              >
                {p.name}
                {p.popular && <PlanTabDot />}
              </PlanTabMobile>
            ))}
          </PlanTabsMobile>
        )}

        <PlansGrid>
          {plans
            .filter((plan) => !isMobile || plan.type === activePlanTab)
            .map((plan, index) => (
            <PlanCard key={index} $popular={plan.popular}>
              {plan.popular && <PopularBadge>Most Popular</PopularBadge>}

              <PlanIcon $popular={plan.popular}>
                {plan.icon}
              </PlanIcon>

              <PlanName>{plan.name}</PlanName>
              <PlanDescription $popular={plan.popular}>{plan.description}</PlanDescription>

              <PriceRow>
                <Price>${getPrice(plan, billingCycle)}</Price>
                <PricePeriod $popular={plan.popular}>/month</PricePeriod>
              </PriceRow>
              <BilledText $popular={plan.popular}>
                {plan.type === 'free'
                  ? 'Free forever'
                  : billingCycle === 'monthly'
                    ? 'Billed monthly'
                    : `Billed $${plan.price.yearly} annually`}
              </BilledText>

              {/* Hide the CTA on the Free card for users who are already on
                  the free plan — they're already using it. Logged-out
                  visitors still see "Get Started Free" as a register CTA. */}
              {!(plan.type === 'free' && user) && (
                <PlanButton
                  $popular={plan.popular}
                  onClick={() => handleSubscribe(plan)}
                  disabled={user?.subscriptionTier === plan.type}
                >
                  {user?.subscriptionTier === plan.type ? 'Current Plan' : plan.buttonText}
                </PlanButton>
              )}
              {plan.type === 'free' && user && (
                <PlanButton $popular={plan.popular} as="div" $current>
                  {user.subscriptionTier === 'free' ? 'Your current plan' : 'Included'}
                </PlanButton>
              )}

              <FeaturesList>
                {plan.features.map((feature, idx) => (
                  <FeatureItem key={idx} $popular={plan.popular}>
                    <CheckIcon />
                    {feature}
                  </FeatureItem>
                ))}
              </FeaturesList>
            </PlanCard>
          ))}
        </PlansGrid>
      </PlansSection>

      {/* Application Credit Packs — only sell tailor + cover letter bundles.
          Mobile: collapsed behind a disclosure so it doesn't add 2 viewports
          to the scroll for a feature most users won't immediately need. */}
      <CreditPacksSection id="credit-packs">
        {isMobile ? (
          <>
            <DisclosureToggle
              type="button"
              onClick={() => setCreditPacksOpenMobile(v => !v)}
              aria-expanded={creditPacksOpenMobile}
            >
              <span>Need extra applications? View credit packs</span>
              <DisclosureChevron $open={creditPacksOpenMobile} aria-hidden="true">▾</DisclosureChevron>
            </DisclosureToggle>
            {creditPacksOpenMobile && (
              <>
                <CreditPacksSubtitle>
                  {TEXT.CREDIT_PACKS_SUBTITLE.split('Credits never expire')[0]}
                  <strong>Credits never expire.</strong>
                </CreditPacksSubtitle>
                <CreditPacksGrid>
                  {CREDIT_PACKS.map((pack) => (
                    <CreditPackCard key={pack.id} $popular={pack.popular} onClick={() => handleBuyPack(pack.id)}>
                      {pack.popular && <PackBadge>{TEXT.BEST_VALUE}</PackBadge>}
                      <PackName>{pack.name}</PackName>
                      <PackDescription>{pack.description}</PackDescription>
                      <PackPrice>${pack.price}</PackPrice>
                      <PackPerCredit>{pack.perCredit}</PackPerCredit>
                      <PackButton $popular={pack.popular} disabled={purchaseLoading === pack.id}>
                        {purchaseLoading === pack.id ? TEXT.PROCESSING : TEXT.BUY_NOW}
                      </PackButton>
                    </CreditPackCard>
                  ))}
                </CreditPacksGrid>
              </>
            )}
          </>
        ) : (
          <>
            <SectionTitle>{TEXT.CREDIT_PACKS_TITLE}</SectionTitle>
            <CreditPacksSubtitle>
              {TEXT.CREDIT_PACKS_SUBTITLE.split('Credits never expire')[0]}
              <strong>Credits never expire.</strong>
            </CreditPacksSubtitle>
            <CreditPacksGrid>
              {CREDIT_PACKS.map((pack) => (
                <CreditPackCard key={pack.id} $popular={pack.popular} onClick={() => handleBuyPack(pack.id)}>
                  {pack.popular && <PackBadge>{TEXT.BEST_VALUE}</PackBadge>}
                  <PackName>{pack.name}</PackName>
                  <PackDescription>{pack.description}</PackDescription>
                  <PackPrice>${pack.price}</PackPrice>
                  <PackPerCredit>{pack.perCredit}</PackPerCredit>
                  <PackButton $popular={pack.popular} disabled={purchaseLoading === pack.id}>
                    {purchaseLoading === pack.id ? TEXT.PROCESSING : TEXT.BUY_NOW}
                  </PackButton>
                </CreditPackCard>
              ))}
            </CreditPacksGrid>
          </>
        )}
      </CreditPacksSection>

      {/* Compare Features. On mobile, hidden behind a disclosure to keep
          the page short — most users decide from the plan card alone. */}
      <CompareSection>
        {isMobile ? (
          <DisclosureToggle
            type="button"
            onClick={() => setCompareOpenMobile(v => !v)}
            aria-expanded={compareOpenMobile}
          >
            <span>{compareOpenMobile ? 'Hide' : 'Show'} full plan comparison</span>
            <DisclosureChevron $open={compareOpenMobile} aria-hidden="true">▾</DisclosureChevron>
          </DisclosureToggle>
        ) : (
          <SectionTitle>{TEXT.COMPARE_TITLE}</SectionTitle>
        )}
        {(!isMobile || compareOpenMobile) && (
        <CompareTable>
          <TableHeader>
            <TableHeaderCell>{TEXT.COL_FEATURES}</TableHeaderCell>
            <TableHeaderCell $center>{TEXT.COL_FREE}</TableHeaderCell>
            <TableHeaderCell $center $highlight>{TEXT.COL_PRO}</TableHeaderCell>
            <TableHeaderCell $center>{TEXT.COL_PRO_PLUS}</TableHeaderCell>
          </TableHeader>

          {COMPARE_FEATURES.map((feature, index) => (
            <TableRow key={index}>
              <TableCell>{feature.name}</TableCell>
              <TableCell $center>{renderFeatureValue(feature.free)}</TableCell>
              <TableCell $center>{renderFeatureValue(feature.pro)}</TableCell>
              <TableCell $center>{renderFeatureValue(feature.proPlus)}</TableCell>
            </TableRow>
          ))}
        </CompareTable>
        )}
      </CompareSection>

      {/* FAQ */}
      <FAQSection>
        <SectionTitle>Frequently Asked Questions</SectionTitle>
        
        {FAQS.map((faq, index) => (
          <FAQItem key={index}>
            <FAQQuestion 
              $open={openFAQ === index}
              onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
            >
              <h4>{faq.question}</h4>
              <ArrowDownIcon />
            </FAQQuestion>
            <FAQAnswer $open={openFAQ === index}>
              <p>{faq.answer}</p>
            </FAQAnswer>
          </FAQItem>
        ))}
      </FAQSection>

      {/* CTA */}
      <CTASection>
        <CTATitle>Ready to supercharge your job search?</CTATitle>
        <CTASubtitle>Start free, upgrade anytime. No credit card required.</CTASubtitle>
        <CTAButtons>
          <CTAButton $primary onClick={() => navigate('/register')}>
            Get Started Free
          </CTAButton>
          <CTAButton onClick={() => window.location.href = 'mailto:support@profileai.com'}>
            Contact Support
          </CTAButton>
        </CTAButtons>
      </CTASection>

      {/* Payment Method Selector */}
      {selectedPlan && (
        <PaymentMethodSelector
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          plan={selectedPlan}
          billingCycle={billingCycle}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Snackbar */}
      <Snackbar $show={snackbar.show} $type={snackbar.type}>
        {snackbar.message}
      </Snackbar>

      {/* Promo Code Modal */}
      <Dialog
        open={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: dialogPaperSx
        }}
      >
        <DialogTitle sx={dialogTitleSx}>
          <Box sx={promoIconBoxSx}>
            <GiftIcon sx={giftIconSx} />
          </Box>
          Promo Code
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth placeholder="Enter promo code" variant="outlined" size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default Pricing;

// Styled Components
const ScrollToTop = () => { useEffect(() => { window.scrollTo(0, 0); }, []); return null; };
