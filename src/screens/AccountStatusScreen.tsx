/**
 * Account Status Screen
 * Displays user's account status including warnings, suspensions, and bans
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { warningsAPI, Warning, AccountStatus, WarningSeverity } from '../services/warningsAPI';
import { useAuth } from '../contexts/AuthContext';

export const AccountStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusData, warningsData] = await Promise.all([
        warningsAPI.getAccountStatus(),
        warningsAPI.getMyWarnings(),
      ]);
      setAccountStatus(statusData);
      setWarnings(warningsData);
    } catch (error: any) {
      console.error('Error loading account status:', error);
      // If authentication is required and user is suspended/deleted, show a helpful message
      if (error.message && error.message.includes('Authentication required')) {
        Alert.alert(
          'Authentication Required',
          'You need to be logged in to view your account status. If your account is suspended, please use the Suspension screen to submit an appeal.',
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to load account status');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981'; // green
      case 'suspended':
        return '#F59E0B'; // amber
      case 'deleted':
        return '#EF4444'; // red
      default:
        return '#6B7280'; // gray
    }
  };

  const getSeverityColor = (severity: WarningSeverity) => {
    switch (severity) {
      case 'high':
        return '#EF4444'; // red
      case 'medium':
        return '#F59E0B'; // amber
      case 'low':
        return '#3B82F6'; // blue
      default:
        return '#6B7280'; // gray
    }
  };

  const getSeverityLabel = (severity: WarningSeverity) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !accountStatus) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Status</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading account status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accountStatus) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Status</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load account status</Text>
          <TouchableOpacity onPress={loadData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayedWarnings = showAllWarnings ? warnings : warnings.slice(0, 3);
  const threshold = accountStatus.warnings.high >= 3 ? 3 : accountStatus.warnings.medium >= 5 ? 5 : 10;
  const progress = accountStatus.warnings.total / threshold;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Status</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(accountStatus.accountStatus) }]}>
            <Text style={styles.statusText}>
              {accountStatus.accountStatus.charAt(0).toUpperCase() + accountStatus.accountStatus.slice(1)}
            </Text>
          </View>
          {accountStatus.accountStatus === 'suspended' && accountStatus.suspension.isSuspended && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Suspension Details</Text>
              <Text style={styles.infoText}>Reason: {accountStatus.suspension.suspensionReason || 'Not specified'}</Text>
              <Text style={styles.infoText}>Suspended: {formatDate(accountStatus.suspension.suspendedAt || null)}</Text>
            </View>
          )}
          {accountStatus.accountStatus === 'deleted' && accountStatus.deletion.isDeleted && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Account Deleted</Text>
              <Text style={styles.infoText}>Deleted: {formatDate(accountStatus.deletion.deletedAt || null)}</Text>
            </View>
          )}
        </View>

        {/* Warnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warnings</Text>
          <View style={styles.warningStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{accountStatus.warnings.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{accountStatus.warnings.high}</Text>
              <Text style={styles.statLabel}>High</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{accountStatus.warnings.medium}</Text>
              <Text style={styles.statLabel}>Medium</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>{accountStatus.warnings.low}</Text>
              <Text style={styles.statLabel}>Low</Text>
            </View>
          </View>

          {/* Progress Indicator */}
          {accountStatus.warnings.total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {accountStatus.warnings.total} / {threshold} warnings toward suspension
              </Text>
            </View>
          )}

          {/* Warning History */}
          {warnings.length > 0 && (
            <View style={styles.warningHistory}>
              <View style={styles.warningHistoryHeader}>
                <Text style={styles.warningHistoryTitle}>Warning History</Text>
                {warnings.length > 3 && (
                  <TouchableOpacity onPress={() => setShowAllWarnings(!showAllWarnings)}>
                    <Text style={styles.viewAllText}>
                      {showAllWarnings ? 'Show Less' : `View All (${warnings.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {displayedWarnings.map((warning) => (
                <View key={warning.id} style={styles.warningItem}>
                  <View style={styles.warningItemHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(warning.severity) }]}>
                      <Text style={styles.severityText}>{getSeverityLabel(warning.severity)}</Text>
                    </View>
                    <Text style={styles.warningDate}>{formatDate(warning.createdAt)}</Text>
                  </View>
                  <Text style={styles.warningReason}>{warning.reason}</Text>
                  {warning.warnedBy && (
                    <Text style={styles.warnedBy}>Issued by: {warning.warnedBy.fullName}</Text>
                  )}
                  {warning.relatedContentType && (
                    <Text style={styles.relatedContent}>
                      Related: {warning.relatedContentType} {warning.relatedContentId?.substring(0, 8)}...
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {warnings.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              <Text style={styles.emptyStateText}>No warnings</Text>
              <Text style={styles.emptyStateSubtext}>Your account is in good standing</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  warningStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  warningHistory: {
    marginTop: 8,
  },
  warningHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  warningItem: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  warningItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  warningDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  warningReason: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  warnedBy: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  relatedContent: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

