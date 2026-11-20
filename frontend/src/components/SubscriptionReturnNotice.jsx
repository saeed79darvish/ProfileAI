import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

/**
 * Stripe Checkout sends people back with ?subscription=success or =cancelled.
 * Say what happened once, then clear the parameter so a refresh does not repeat it.
 * The plan itself is granted by Stripe's webhook, not by this page.
 */
export default function SubscriptionReturnNotice() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const result = params.get('subscription');
    if (result !== 'success' && result !== 'cancelled') return;
    if (result === 'success') {
      toast.success('Payment received. Your plan is active within a minute; reload if you do not see it yet.', 8000);
    } else {
      toast.info('Checkout cancelled. You were not charged.');
    }
    params.delete('subscription');
    const rest = params.toString();
    navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true });
  }, [search, pathname, navigate, toast]);

  return null;
}
