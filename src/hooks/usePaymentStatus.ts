import { useState, useEffect, useRef } from 'react';
import { walletAPI, DepositResponse } from '../services/walletAPI';
import { AppState, AppStateStatus } from 'react-native';

interface UsePaymentStatusOptions {
  depositId: string;
  onSuccess?: (deposit: DepositResponse) => void;
  onFailure?: (deposit: DepositResponse) => void;
  pollInterval?: number; // milliseconds
  maxPollAttempts?: number;
}

interface UsePaymentStatusReturn {
  deposit: DepositResponse | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
}

/**
 * Hook to poll for deposit payment status
 * Useful when user returns from Flutterwave payment page
 */
export const usePaymentStatus = (options: UsePaymentStatusOptions): UsePaymentStatusReturn => {
  const {
    depositId,
    onSuccess,
    onFailure,
    pollInterval = 5000, // Poll every 5 seconds
    maxPollAttempts = 60, // Max 5 minutes (60 * 5s)
  } = options;

  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Fetch deposit status
  const fetchDeposit = async () => {
    try {
      setError(null);
      const deposits = await walletAPI.getDeposits();
      const foundDeposit = deposits.find((d) => d.id === depositId);

      if (!foundDeposit) {
        setError('Deposit not found');
        stopPolling();
        // Trigger failure callback with error info
        onFailure?.({
          id: depositId,
          status: 'failed',
          failureReason: 'Deposit record not found. Please check your transaction history.',
        } as any);
        return;
      }

      setDeposit(foundDeposit);

      // Check if payment is complete
      if (foundDeposit.status === 'completed') {
        stopPolling();
        onSuccess?.(foundDeposit);
      } else if (foundDeposit.status === 'failed' || foundDeposit.status === 'cancelled') {
        stopPolling();
        onFailure?.(foundDeposit);
      }
    } catch (err: any) {
      console.error('Error fetching deposit status:', err);
      setError(err.message || 'Failed to fetch deposit status');
    } finally {
      setLoading(false);
    }
  };

  // Start polling
  const startPolling = () => {
    if (isPolling) return;

    setIsPolling(true);
    pollAttemptsRef.current = 0;

    const poll = async () => {
      pollAttemptsRef.current += 1;

      if (pollAttemptsRef.current > maxPollAttempts) {
        console.log('Max poll attempts reached');
        stopPolling();
        return;
      }

      await fetchDeposit();

      // Continue polling if deposit is still pending
      if (deposit?.status === 'pending' || deposit?.status === 'processing') {
        pollIntervalRef.current = setTimeout(poll, pollInterval);
      } else {
        stopPolling();
      }
    };

    // Start polling immediately
    poll();
  };

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Refresh manually
  const refresh = async () => {
    setLoading(true);
    await fetchDeposit();
  };

  // Initial fetch
  useEffect(() => {
    fetchDeposit();
  }, [depositId]);

  // Handle app state changes (resume polling when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isPolling
      ) {
        // App came to foreground, refresh status
        refresh();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    deposit,
    loading,
    error,
    isPolling,
    startPolling,
    stopPolling,
    refresh,
  };
};

