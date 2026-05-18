import React, { useState } from 'react';

interface PromoCodeRedeemProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const PromoCodeRedeem: React.FC<PromoCodeRedeemProps> = ({ onSuccess, onError }) => {
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; benefit?: string } | null>(null);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setIsRedeeming(true);
    setResult(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REDEEM_PROMO',
        data: { code: code.trim() },
      });

      if (response?.error) {
        setResult({ success: false, message: response.error });
        onError?.(response.error);
      } else {
        setResult({
          success: true,
          message: response.message || 'Promo code applied!',
          benefit: response.benefit,
        });
        setCode('');
        onSuccess?.(response.message || 'Promo applied!');
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to redeem code';
      setResult({ success: false, message: msg });
      onError?.(msg);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="promo-code-section">
      <button
        className="promo-toggle-btn"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span className="promo-icon">🎁</span>
        <span>Have a promo code?</span>
        <span className={`promo-chevron ${expanded ? 'expanded' : ''}`}>›</span>
      </button>

      {expanded && (
        <div className="promo-input-area">
          <div className="promo-input-row">
            <input
              type="text"
              className="promo-input"
              placeholder="Enter code (e.g. LAUNCH2X)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              disabled={isRedeeming}
              maxLength={30}
            />
            <button
              className="promo-submit-btn"
              onClick={handleRedeem}
              disabled={isRedeeming || !code.trim()}
            >
              {isRedeeming ? '...' : 'Apply'}
            </button>
          </div>

          {result && (
            <div className={`promo-result ${result.success ? 'success' : 'error'}`}>
              <span>{result.message}</span>
              {result.benefit && <span className="promo-benefit">{result.benefit}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
