/**
 * Suspension Screen
 * Displays when a user's account has been suspended or deleted
 * Blocks access to the app until account is reactivated
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { warningsAPI, AccountStatus } from '../services/warningsAPI';
import { appealsAPI, Appeal, AppealStatusResponse } from '../services/appealsAPI';
import { useAuth } from '../contexts/AuthContext';

export const SuspensionScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, signout, isSuspended: authIsSuspended, isDeleted: authIsDeleted, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [appealStatus, setAppealStatus] = useState<AppealStatusResponse | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  useEffect(() => {
    // Only load if we have a user ID (from suspended login)
    if (user?.id) {
      loadAccountStatus();
      loadAppealStatus();
    } else {
      // If no user ID, show a message that they need to log in first
      // But since they're suspended, they can't log in - this is a catch-22
      // For now, we'll show the screen with limited functionality
      setLoading(false);
    }
  }, [user?.id]);

  const loadAccountStatus = async () => {
    try {
      setLoading(true);
      // Pass token from auth context if available
      const status = await warningsAPI.getAccountStatus(accessToken);
      setAccountStatus(status);
    } catch (error: any) {
      console.error('Error loading account status:', error);
      // If error is due to missing auth, we can still show the screen
      // The user can still submit an appeal if they have the user ID
      // Don't show an alert - just silently fail and show the screen with limited info
      // The screen will use authIsSuspended/authIsDeleted as fallback
    } finally {
      setLoading(false);
    }
  };

  const loadAppealStatus = async () => {
    try {
      // Only try to load if we have a user ID
      if (user?.id) {
        // Pass token from auth context if available
        const status = await appealsAPI.getAppealStatus(accessToken);
        setAppealStatus(status);
      }
    } catch (error: any) {
      console.error('Error loading appeal status:', error);
      // If error is due to missing auth, we can still show the screen
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your appeal');
      return;
    }

    try {
      setSubmittingAppeal(true);
      // Pass token from auth context if available
      await appealsAPI.submitAppeal(appealReason, accessToken);
      setAppealSuccess(true);
      setShowAppealForm(false);
      setAppealReason('');
      await loadAppealStatus(); // Refresh appeal status
      Alert.alert('Success', 'Your appeal has been submitted. We will review it and get back to you.');
    } catch (error: any) {
      if (error.message && error.message.includes('suspended')) {
        Alert.alert(
          'Access Restricted',
          error.message || 'Your account has been suspended. You can only access account status and appeals.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to submit appeal. Please try again.');
      }
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleViewDetails = () => {
    navigation.navigate('AccountStatus' as never);
  };

  const handleLogout = async () => {
    await signout();
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

  // Get suspension/deletion status from accountStatus if available, otherwise from auth context
  const isDeleted = accountStatus?.accountStatus === 'deleted' || accountStatus?.deletion.isDeleted || authIsDeleted;
  const isSuspended = accountStatus?.accountStatus === 'suspended' || accountStatus?.suspension.isSuspended || authIsSuspended;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading account status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, isDeleted && { borderColor: '#EF4444' }]}>
            <Ionicons 
              name={isDeleted ? "trash" : "ban"} 
              size={64} 
              color={isDeleted ? "#EF4444" : "#F59E0B"} 
            />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isDeleted ? 'Account Deleted' : 'Account Suspended'}
        </Text>
        <Text style={styles.subtitle}>
          {isDeleted 
            ? 'Your account has been permanently deleted'
            : 'Your account has been temporarily suspended'}
        </Text>

        {/* Suspension/Deletion Details */}
        {isSuspended && accountStatus?.suspension.isSuspended && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Suspension Details</Text>
            {accountStatus.suspension.suspensionReason && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reason:</Text>
                <Text style={styles.detailValue}>
                  {accountStatus.suspension.suspensionReason}
                </Text>
              </View>
            )}
            {accountStatus.suspension.suspendedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Suspended On:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(accountStatus.suspension.suspendedAt)}
                </Text>
              </View>
            )}
          </View>
        )}

        {isDeleted && accountStatus?.deletion.isDeleted && (
          <View style={[styles.detailsCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
            <Text style={styles.detailsTitle}>Deletion Details</Text>
            {accountStatus.deletion.deletedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Deleted On:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(accountStatus.deletion.deletedAt)}
                </Text>
              </View>
            )}
            {accountStatus.deletion.deletedBy && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Deleted By:</Text>
                <Text style={styles.detailValue}>
                  {accountStatus.deletion.deletedBy}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Warning Info */}
        {accountStatus && accountStatus.warnings.total > 0 && (
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.warningTitle}>Warning History</Text>
            </View>
            <Text style={styles.warningText}>
              You have received {accountStatus.warnings.total} warning
              {accountStatus.warnings.total !== 1 ? 's' : ''} on your account.
            </Text>
            <Text style={styles.warningSubtext}>
              {accountStatus.warnings.high} high, {accountStatus.warnings.medium} medium,{' '}
              {accountStatus.warnings.low} low severity
            </Text>
          </View>
        )}

        {/* Information Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#9CA3AF" />
          <Text style={styles.infoText}>
            {isDeleted 
              ? 'Your account has been permanently deleted and all associated data has been removed. You cannot access the app. If you believe this is an error, please contact support.'
              : 'While your account is suspended, you cannot access most features of the app. Please contact support if you believe this is an error or if you have questions about your suspension.'}
          </Text>
        </View>

        {/* Appeal Section - Only show for suspended accounts (use auth context if accountStatus not loaded) */}
        {(isSuspended || authIsSuspended) && !isDeleted && !authIsDeleted && (
          <View style={styles.appealSection}>
            {appealStatus?.hasPendingAppeal ? (
              <View style={styles.appealStatusCard}>
                <View style={styles.appealStatusHeader}>
                  <Ionicons name="time" size={24} color="#F59E0B" />
                  <Text style={styles.appealStatusTitle}>Appeal Submitted</Text>
                </View>
                <Text style={styles.appealStatusText}>
                  Your appeal is currently {appealStatus.latestAppeal?.status === 'under_review' 
                    ? 'under review' 
                    : 'pending review'}. We will notify you once a decision has been made.
                </Text>
                {appealStatus.latestAppeal?.createdAt && (
                  <Text style={styles.appealStatusDate}>
                    Submitted: {formatDate(appealStatus.latestAppeal.createdAt)}
                  </Text>
                )}
              </View>
            ) : appealSuccess ? (
              <View style={[styles.appealStatusCard, { borderLeftColor: '#10B981' }]}>
                <View style={styles.appealStatusHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.appealStatusTitle}>Appeal Submitted Successfully</Text>
                </View>
                <Text style={styles.appealStatusText}>
                  Your appeal has been submitted. We will review it and get back to you soon.
                </Text>
              </View>
            ) : !showAppealForm ? (
              <TouchableOpacity
                style={styles.appealButton}
                onPress={() => setShowAppealForm(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                <Text style={styles.appealButtonText}>Submit Appeal</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.appealFormCard}>
                <Text style={styles.appealFormTitle}>Submit Suspension Appeal</Text>
                <Text style={styles.appealFormSubtitle}>
                  Please explain why you believe your suspension should be lifted.
                </Text>
                <TextInput
                  style={styles.appealInput}
                  placeholder="Enter your appeal reason..."
                  placeholderTextColor="#9CA3AF"
                  value={appealReason}
                  onChangeText={setAppealReason}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
                <View style={styles.appealFormActions}>
                  <TouchableOpacity
                    style={styles.appealCancelButton}
                    onPress={() => {
                      setShowAppealForm(false);
                      setAppealReason('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.appealCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.appealSubmitButton, submittingAppeal && styles.appealSubmitButtonDisabled]}
                    onPress={handleSubmitAppeal}
                    disabled={submittingAppeal}
                    activeOpacity={0.8}
                  >
                    {submittingAppeal ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.appealSubmitText}>Submit</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleViewDetails}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>View Account Status</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out" size={20} color="#F59E0B" />
            <Text style={styles.secondaryButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100, // Increased padding to ensure buttons are accessible when keyboard is open
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
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  detailsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  warningCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 12,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  appealSection: {
    marginBottom: 24,
  },
  appealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  appealButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appealFormCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  appealFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  appealFormSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  appealInput: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
  },
  appealFormActions: {
    flexDirection: 'row',
    gap: 12,
  },
  appealCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  appealCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  appealSubmitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  appealSubmitButtonDisabled: {
    opacity: 0.5,
  },
  appealSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appealStatusCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  appealStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  appealStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appealStatusText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    lineHeight: 20,
  },
  appealStatusDate: {
    fontSize: 12,
    color: '#6B7280',
  },
});

