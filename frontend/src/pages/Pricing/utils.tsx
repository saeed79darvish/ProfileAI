import React from 'react';
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';

export const getPrice = (plan: { price: { monthly: number; yearly: number } }, billingCycle: string) => {
  return billingCycle === 'monthly' ? plan.price.monthly : Math.round((plan.price.yearly / 12) * 100) / 100;
};

export const renderFeatureValue = (value: string | boolean) => {
  if (typeof value === 'boolean') {
    return value ? <CheckIcon className="check" /> : <CloseIcon className="cross" />;
  }
  return value;
};
