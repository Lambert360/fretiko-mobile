// Network connectivity test for Expo SDK 54 compatibility
// This helps debug authentication issues

import { API_CONFIG } from '../config/api';

export const testBackendConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔍 Testing backend connection...');
    console.log('📡 Backend URL:', API_CONFIG.BASE_URL);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_CONFIG.BASE_URL}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.text();
      console.log('✅ Backend connection successful:', data);
      return {
        success: true,
        message: `Connected to backend successfully. Response: ${data}`,
        details: { status: response.status, data }
      };
    } else {
      console.log('❌ Backend returned error:', response.status);
      return {
        success: false,
        message: `Backend returned error: ${response.status} ${response.statusText}`,
        details: { status: response.status, statusText: response.statusText }
      };
    }
  } catch (error: any) {
    console.log('❌ Network test failed:', error.message);

    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'Connection timeout - backend may be down or unreachable',
        details: { error: 'timeout' }
      };
    }

    return {
      success: false,
      message: `Network error: ${error.message}`,
      details: { error: error.message, type: error.name }
    };
  }
};

export const debugAuthFlow = async () => {
  console.log('🔧 Debug: Starting auth flow diagnostics...');

  const networkTest = await testBackendConnection();
  console.log('🔧 Network Test Result:', networkTest);

  // Test if SecureStore is available
  try {
    const { isAvailableAsync } = await import('expo-secure-store');
    const isAvailable = isAvailableAsync ? await isAvailableAsync() : true;
    console.log('🔧 SecureStore Available:', isAvailable);
  } catch (error) {
    console.log('🔧 SecureStore Error:', error);
  }

  return networkTest;
};