import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { apiInitializer } from '../services/apiInitializer';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState(apiInitializer.getStatus());
  const [showDetails, setShowDetails] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setStatus(apiInitializer.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Show/hide animation
    Animated.timing(fadeAnim, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showDetails]);

  const getStatusColor = () => {
    if (!status.networkConnected) return '#FF3B30'; // Red for offline
    if (!status.backendHealthy) return '#FF9500'; // Orange for server issues
    if (status.realtimeAPI) return '#30D158'; // Green for full connectivity
    return '#007AFF'; // Blue for basic connectivity
  };

  const getStatusIcon = () => {
    if (!status.networkConnected) return 'cloud-offline-outline';
    if (!status.backendHealthy) return 'warning-outline';
    if (status.realtimeAPI) return 'cloud-done-outline';
    return 'cloud-outline';
  };

  const getStatusText = () => {
    return apiInitializer.getStatusMessage();
  };

  const handleStatusPress = () => {
    setShowDetails(!showDetails);
  };

  const handleRefresh = async () => {
    try {
      await apiInitializer.refresh();
      setStatus(apiInitializer.getStatus());
    } catch (error) {
      console.error('Failed to refresh API status:', error);
    }
  };

  // Don't show if fully connected (green status)
  if (status.networkConnected && status.backendHealthy && status.realtimeAPI) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <TouchableOpacity 
        style={[styles.statusBar, { backgroundColor: getStatusColor() }]}
        onPress={handleStatusPress}
      >
        <Ionicons name={getStatusIcon()} size={16} color="#FFFFFF" />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        <Ionicons 
          name={showDetails ? "chevron-up" : "chevron-down"} 
          size={16} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>

      {/* Details Panel */}
      {showDetails && (
        <Animated.View style={[styles.detailsContainer, { opacity: fadeAnim }]}>
          <BlurView intensity={60} style={styles.detailsBlur}>
            <View style={styles.detailsContent}>
              <Text style={styles.detailsTitle}>Connection Details</Text>
              
              <View style={styles.statusItem}>
                <View style={styles.statusItemLeft}>
                  <Ionicons 
                    name={status.networkConnected ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={status.networkConnected ? "#30D158" : "#FF3B30"} 
                  />
                  <Text style={styles.statusItemText}>Network</Text>
                </View>
                <Text style={styles.statusItemValue}>
                  {status.networkConnected ? "Connected" : "Offline"}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <View style={styles.statusItemLeft}>
                  <Ionicons 
                    name={status.backendHealthy ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={status.backendHealthy ? "#30D158" : "#FF3B30"} 
                  />
                  <Text style={styles.statusItemText}>Backend</Text>
                </View>
                <Text style={styles.statusItemValue}>
                  {status.backendHealthy ? "Healthy" : "Unavailable"}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <View style={styles.statusItemLeft}>
                  <Ionicons 
                    name={status.servicesAPI ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={status.servicesAPI ? "#30D158" : "#FF3B30"} 
                  />
                  <Text style={styles.statusItemText}>Services API</Text>
                </View>
                <Text style={styles.statusItemValue}>
                  {status.servicesAPI ? "Ready" : "Error"}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <View style={styles.statusItemLeft}>
                  <Ionicons 
                    name={status.realtimeAPI ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={status.realtimeAPI ? "#30D158" : "#FF9500"} 
                  />
                  <Text style={styles.statusItemText}>Real-time</Text>
                </View>
                <Text style={styles.statusItemValue}>
                  {status.realtimeAPI ? "Connected" : "Offline"}
                </Text>
              </View>

              {/* Refresh Button */}
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <Ionicons name="refresh-outline" size={18} color="#007AFF" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>

              {/* Info Text */}
              <Text style={styles.infoText}>
                {!status.networkConnected 
                  ? "Your actions will sync when you're back online."
                  : !status.backendHealthy
                  ? "Working offline until servers are available."
                  : "Some real-time features may not work."
                }
              </Text>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
    flex: 1,
    textAlign: 'center',
  },
  detailsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
  },
  detailsBlur: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  statusItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  statusItemValue: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,122,255,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.3)',
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});