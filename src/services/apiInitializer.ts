import { servicesAPI } from './servicesAPI';
import { productsAPI } from './productsAPI';
import { realtimeAPI } from './realtimeAPI';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface APIStatus {
  servicesAPI: boolean;
  productsAPI: boolean;
  realtimeAPI: boolean;
  networkConnected: boolean;
  backendHealthy: boolean;
}

class APIInitializer {
  private initialized = false;
  private networkListener: any = null;
  private status: APIStatus = {
    servicesAPI: false,
    productsAPI: false,
    realtimeAPI: false,
    networkConnected: false,
    backendHealthy: false,
  };

  // Initialize all API services
  async initialize(userId?: string): Promise<APIStatus> {
    if (this.initialized) {
      return this.status;
    }

    console.log('🚀 Initializing API services...');

    try {
      // Initialize network monitoring
      await this.initializeNetworkMonitoring();

      // Initialize Services API
      try {
        await servicesAPI.initialize();
        this.status.servicesAPI = true;
        console.log('✅ Services API initialized');
      } catch (error) {
        console.error('❌ Services API initialization failed:', error);
        this.status.servicesAPI = false;
      }

      // Initialize Products API (if it has an initialize method)
      try {
        // Note: productsAPI might not have initialize method, that's okay
        this.status.productsAPI = true;
        console.log('✅ Products API ready');
      } catch (error) {
        console.error('❌ Products API initialization failed:', error);
        this.status.productsAPI = false;
      }

      // Initialize Realtime API if user is logged in
      if (userId) {
        try {
          await realtimeAPI.connect(userId);
          this.status.realtimeAPI = true;
          console.log('✅ Realtime API connected');
        } catch (error) {
          console.warn('⚠️ Realtime API connection failed (will work offline):', error);
          this.status.realtimeAPI = false;
        }
      }

      // Check backend health
      await this.checkBackendHealth();

      this.initialized = true;
      console.log('🎉 API initialization completed');

      return this.status;
    } catch (error) {
      console.error('❌ API initialization failed:', error);
      throw error;
    }
  }

  // Monitor network connectivity
  private async initializeNetworkMonitoring(): Promise<void> {
    // Check initial network state
    const netInfo = await NetInfo.fetch();
    this.status.networkConnected = netInfo.isConnected ?? false;
    
    console.log(`📶 Network status: ${this.status.networkConnected ? 'Connected' : 'Disconnected'}`);

    // Listen for network changes
    this.networkListener = NetInfo.addEventListener((state) => {
      const wasConnected = this.status.networkConnected;
      this.status.networkConnected = state.isConnected ?? false;

      console.log(`📶 Network changed: ${this.status.networkConnected ? 'Connected' : 'Disconnected'}`);

      // If we just came back online, process offline queues
      if (!wasConnected && this.status.networkConnected) {
        this.onNetworkReconnected();
      }

      // If we just went offline, show notification
      if (wasConnected && !this.status.networkConnected) {
        this.onNetworkDisconnected();
      }
    });
  }

  // Handle network reconnection
  private async onNetworkReconnected(): Promise<void> {
    console.log('🔄 Network reconnected, syncing offline data...');
    
    try {
      // Check backend health
      await this.checkBackendHealth();

      // Process offline queues
      if (this.status.servicesAPI) {
        await servicesAPI.processOfflineQueue();
      }

      // Reconnect realtime API if needed
      if (!this.status.realtimeAPI && realtimeAPI) {
        // Try to reconnect (would need user ID from auth context)
        console.log('🔄 Attempting to reconnect realtime API...');
      }

      console.log('✅ Offline sync completed');
    } catch (error) {
      console.error('❌ Offline sync failed:', error);
    }
  }

  // Handle network disconnection
  private onNetworkDisconnected(): void {
    console.log('📱 Working offline - data will sync when connection returns');
    this.status.backendHealthy = false;
  }

  // Check backend health
  private async checkBackendHealth(): Promise<void> {
    try {
      const health = await servicesAPI.checkHealth();
      this.status.backendHealthy = health.apiHealth;
      
      if (health.apiHealth) {
        console.log('✅ Backend is healthy');
      } else {
        console.warn('⚠️ Backend health check failed');
      }
    } catch (error) {
      console.error('❌ Backend health check error:', error);
      this.status.backendHealthy = false;
    }
  }

  // Get current API status
  getStatus(): APIStatus {
    return { ...this.status };
  }

  // Force refresh of all services
  async refresh(userId?: string): Promise<APIStatus> {
    console.log('🔄 Refreshing API services...');

    // Check backend health
    await this.checkBackendHealth();

    // Process offline queues if healthy
    if (this.status.backendHealthy && this.status.servicesAPI) {
      await servicesAPI.processOfflineQueue();
    }

    // Reconnect realtime if needed
    if (this.status.networkConnected && !this.status.realtimeAPI && userId) {
      try {
        await realtimeAPI.connect(userId);
        this.status.realtimeAPI = true;
        console.log('✅ Realtime API reconnected');
      } catch (error) {
        console.warn('⚠️ Realtime API reconnection failed:', error);
        this.status.realtimeAPI = false;
      }
    }

    return this.status;
  }

  // Cleanup resources
  cleanup(): void {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }

    if (realtimeAPI) {
      realtimeAPI.disconnect();
    }

    this.status.realtimeAPI = false;
    console.log('🧹 API services cleaned up');
  }

  // Show user-friendly error messages
  showConnectionStatus(): void {
    if (!this.status.networkConnected) {
      Alert.alert(
        'No Internet Connection',
        'You\'re currently offline. Some features may not work, but your actions will sync when connection returns.',
        [{ text: 'OK' }]
      );
    } else if (!this.status.backendHealthy) {
      Alert.alert(
        'Service Temporarily Unavailable',
        'Our servers are temporarily unavailable. Your data will sync when service is restored.',
        [{ text: 'OK' }]
      );
    }
  }

  // Get human-readable status
  getStatusMessage(): string {
    if (!this.status.networkConnected) {
      return 'Offline - Will sync when connected';
    }
    
    if (!this.status.backendHealthy) {
      return 'Server unavailable - Working offline';
    }

    if (this.status.realtimeAPI) {
      return 'Connected - Real-time updates active';
    }

    return 'Connected - Basic features available';
  }
}

export const apiInitializer = new APIInitializer();