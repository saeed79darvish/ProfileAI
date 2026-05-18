import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  CheckCircle as SuccessIcon,
  Schedule as ClockIcon,
  LocalOffer as TagIcon
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { promoAPI } from '../services/api';

const Card = styled.div`
  padding: 4px 0;
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const CodeInput = styled.input`
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e0e2e9;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  transition: border-color 0.2s;
  background: #f7f8fc;
  color: #1a1a2e;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
  &::placeholder {
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: #8b8fa3;
  }
  &:disabled { background: #f0f1f8; }
`;

const ApplyBtn = styled.button`
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s, transform 0.1s;

  &:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ResultMsg = styled.div`
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;

  &.success {
    background: rgba(16, 185, 129, 0.06);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.15);
  }
  &.error {
    background: rgba(239, 68, 68, 0.06);
    color: #DC2626;
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  .benefit {
    display: block;
    margin-top: 4px;
    font-weight: 600;
  }
`;

const ActivePromos = styled.div`
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PromoChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.04);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 10px;
  font-size: 13px;

  .promo-code {
    font-weight: 700;
    color: #667eea;
    letter-spacing: 0.5px;
  }
  .promo-desc {
    flex: 1;
    color: #5a5d73;
  }
  .days-left {
    font-size: 12px;
    color: #667eea;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

export default function PromoCodeInput({ compact = false }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activePromos, setActivePromos] = useState([]);
  const [promosLoaded, setPromosLoaded] = useState(false);

  useEffect(() => {
    if (!promosLoaded) {
      loadActivePromos();
    }
  }, []);

  const loadActivePromos = async () => {
    try {
      const { data } = await promoAPI.getMyPromos();
      setActivePromos(data.activePromos || []);
      setPromosLoaded(true);
    } catch (err) {
      console.error('Failed to load active promos:', err);
    }
  };

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await promoAPI.redeem(code.trim());
      setResult({ success: true, message: data.message, benefit: data.benefit });
      setCode('');
      loadActivePromos();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to redeem promo code';
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <InputRow>
        <CodeInput
          type="text"
          placeholder="Enter promo code..."
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleRedeem()}
          disabled={loading}
          maxLength={30}
        />
        <ApplyBtn onClick={handleRedeem} disabled={loading || !code.trim()}>
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
        </ApplyBtn>
      </InputRow>

      {result && (
        <ResultMsg className={result.success ? 'success' : 'error'}>
          {result.success ? <SuccessIcon fontSize="small" /> : null}
          <div>
            {result.message}
            {result.benefit && <span className="benefit">{result.benefit}</span>}
          </div>
        </ResultMsg>
      )}

      {activePromos.length > 0 && (
        <ActivePromos>
          {activePromos.map((p) => (
            <PromoChip key={p.id}>
              <TagIcon sx={{ fontSize: 16, color: '#667eea' }} />
              <span className="promo-code">{p.code}</span>
              <span className="promo-desc">
                {p.dailyMultiplier > 1 ? `${p.dailyMultiplier}x AI credits` : ''}
                {p.dailyBonusFlat > 0 ? ` +${p.dailyBonusFlat} bonus` : ''}
              </span>
              <span className="days-left">
                <ClockIcon sx={{ fontSize: 14 }} />
                {p.daysRemaining}d left
              </span>
            </PromoChip>
          ))}
        </ActivePromos>
      )}
    </Card>
  );
}
