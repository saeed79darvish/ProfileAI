import { useState, useCallback } from 'react';

/**
 * Hook to handle AI rate limit errors and show upgrade modal
 * 
 * Usage:
 * const { handleAIError, UpgradeModalComponent, checkRateLimit } = useAIRateLimit();
 * 
 * try {
 *   await someAICall();
 * } catch (err) {
 *   if (!handleAIError(err)) {
 *     // Handle other errors
 *   }
 * }
 */
export const useAIRateLimit = () => {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [limitedFeature, setLimitedFeature] = useState('');

  /**
   * Handle an error from an AI API call
   * Returns true if it was a rate limit error (handled), false otherwise
   */
  const handleAIError = useCallback((error) => {
    if (error.response?.status === 429) {
      const feature = error.response.data?.feature || '';
      setLimitedFeature(feature);
      setShowUpgrade(true);
      return true;
    }
    return false;
  }, []);

  /**
   * Close the upgrade modal
   */
  const closeUpgrade = useCallback(() => {
    setShowUpgrade(false);
    setLimitedFeature('');
  }, []);

  /**
   * Manually trigger the upgrade modal for a specific feature
   */
  const showUpgradeFor = useCallback((feature) => {
    setLimitedFeature(feature);
    setShowUpgrade(true);
  }, []);

  return {
    showUpgrade,
    limitedFeature,
    handleAIError,
    closeUpgrade,
    showUpgradeFor,
    // For convenience, return props to spread to UpgradeModal
    upgradeModalProps: {
      open: showUpgrade,
      onClose: closeUpgrade,
      feature: limitedFeature
    }
  };
};

export default useAIRateLimit;
