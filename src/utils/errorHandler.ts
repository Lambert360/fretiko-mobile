import { Alert } from 'react-native';

/**
 * Error types enum for categorizing different error scenarios
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error information interface
 */
export interface ErrorInfo {
  type: ErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
  userMessage: string;
}

/**
 * Determine error type from error object
 */
export const getErrorType = (error: any): ErrorType => {
  if (!error) return ErrorType.UNKNOWN_ERROR;

  // Network errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return ErrorType.TIMEOUT_ERROR;
  }
  if (error.message === 'Network Error' || error.code === 'NETWORK_ERROR') {
    return ErrorType.NETWORK_ERROR;
  }

  // HTTP status codes
  if (error.response?.status) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return ErrorType.AUTH_ERROR;
    }
    if (status >= 400 && status < 500) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (status >= 500) {
      return ErrorType.SERVER_ERROR;
    }
  }

  return ErrorType.UNKNOWN_ERROR;
};

/**
 * Check if error is retryable
 */
export const isRetryable = (errorType: ErrorType): boolean => {
  return [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVER_ERROR,
  ].includes(errorType);
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (errorType: ErrorType, originalMessage?: string): string => {
  const messages: Record<ErrorType, string> = {
    [ErrorType.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
    [ErrorType.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
    [ErrorType.SERVER_ERROR]: 'Server error occurred. Please try again later.',
    [ErrorType.AUTH_ERROR]: 'Authentication failed. Please log in again.',
    [ErrorType.VALIDATION_ERROR]: originalMessage || 'Invalid request. Please check your input.',
    [ErrorType.UNKNOWN_ERROR]: originalMessage || 'An unexpected error occurred. Please try again.',
  };

  return messages[errorType] || messages[ErrorType.UNKNOWN_ERROR];
};

/**
 * Parse error and extract information
 */
export const parseError = (error: any): ErrorInfo => {
  const type = getErrorType(error);
  const retryable = isRetryable(type);
  const originalMessage = error?.response?.data?.message || error?.message;
  const userMessage = getUserFriendlyMessage(type, originalMessage);

  return {
    type,
    message: originalMessage || 'Unknown error',
    originalError: error,
    retryable,
    userMessage,
  };
};

/**
 * Show error alert with retry option
 */
export const showErrorAlert = (
  errorInfo: ErrorInfo,
  onRetry?: () => void,
  onDismiss?: () => void
): void => {
  const buttons: any[] = [];

  if (errorInfo.retryable && onRetry) {
    buttons.push({
      text: 'Retry',
      onPress: onRetry,
      style: 'default',
    });
  }

  buttons.push({
    text: 'OK',
    onPress: onDismiss,
    style: 'cancel',
  });

  Alert.alert('Error', errorInfo.userMessage, buttons);
};

/**
 * Handle error with automatic retry logic
 */
export const handleErrorWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  onError?: (errorInfo: ErrorInfo, attempt: number) => void
): Promise<T> => {
  let lastError: any;
  let lastErrorInfo: ErrorInfo | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      lastErrorInfo = parseError(error);

      // Don't retry on non-retryable errors
      if (!lastErrorInfo.retryable) {
        if (onError) {
          onError(lastErrorInfo, attempt);
        }
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        if (onError) {
          onError(lastErrorInfo, attempt);
        }
        throw error;
      }

      // Call error callback for retryable errors
      if (onError) {
        onError(lastErrorInfo, attempt);
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`🔄 Retrying operation (attempt ${attempt + 2}/${maxRetries + 1}) after ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Simple error handler that shows alert
 */
export const handleError = (
  error: any,
  onRetry?: () => void,
  onDismiss?: () => void
): ErrorInfo => {
  const errorInfo = parseError(error);
  showErrorAlert(errorInfo, onRetry, onDismiss);
  return errorInfo;
};

