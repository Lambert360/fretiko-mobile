import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI } from '../services/ordersAPI';
import { workspaceAPI } from '../services/workspaceAPI';

interface Props {
  navigation: any;
  route: {
    params: {
      orderId: string;
    };
  };
}

const OrderLinkHandlerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const { orderId } = route.params;

  useEffect(() => {
    resolveOrder();
  }, []);

  const resolveOrder = async () => {
    if (!isAuthenticated) {
      navigation.replace('Login');
      return;
    }

    // Buyers view orders in OrderTracking; vendors view them in VendorOrderDetails.
    // Probe the buyer endpoint first, then the vendor endpoint.
    try {
      await ordersAPI.getOrderDetails(orderId);
      navigation.replace('OrderTracking', { orderId });
      return;
    } catch {
      // Not the buyer — try vendor access
    }

    try {
      await workspaceAPI.getOrderDetails(orderId);
      navigation.replace('VendorOrderDetails', { orderId });
      return;
    } catch {
      // Not a party to this order
    }

    Alert.alert('Unavailable', 'You do not have access to this order.');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF8A00" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
});

export default OrderLinkHandlerScreen;
