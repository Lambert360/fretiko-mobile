import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { walletAPI, Wallet, WalletStats, WalletTransaction } from '../services/walletAPI';
import { rewardsAPI, WalletDisplayRewards } from '../services/rewardsAPI';
import * as SecureStore from 'expo-secure-store';
import { realtimeAPI } from '../services/realtimeAPI';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

interface WalletScreenProps {
  navigation: any;
}

interface UserProfile {
  id: string;
  username: string;
  isSeller: boolean;
  isRider?: boolean;
}

const WalletScreen = ({ navigation }: WalletScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // State management
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rewards, setRewards] = useState<WalletDisplayRewards | null>(null);
  const [pendingEscrows, setPendingEscrows] = useState<{ vendorAmount: number; riderAmount: number; totalPending: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('FRETI');
  const [showLocalEquivalent, setShowLocalEquivalent] = useState(false);
  

  const screenWidth = Dimensions.get('window').width;
  
  const currencies = ['FRETI', 'USD', 'EUR', 'GBP', 'NGN'];

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    loadWalletData();

    // Setup real-time wallet balance updates
    const walletBalanceListener = realtimeAPI.subscribe('wallet_balance_update', (data: any) => {
      console.log('💰 Wallet balance update received:', data);
      
      // Refresh wallet data from API instead of using realtime balance data
      // This ensures we get the correct balance after transactions
      loadWalletData();
    });

    // ✅ NEW: Listen for escrow release events
    const escrowReleaseListener = realtimeAPI.subscribe('escrow_released', (data: any) => {
      console.log('💸 Escrow released received:', data);
      
      // Show notification
      Alert.alert(
        'Payment Released! 💰',
        `₣${data.amount.toLocaleString()} has been credited to your wallet for order #${data.orderNumber}`,
        [{ text: 'OK', onPress: () => loadWalletData() }]
      );
      
      // Reload wallet data to get updated balances
      loadWalletData();
    });

    // ✅ NEW: Auto-sync cached transactions when coming back online
    const handleOnlineStatus = async () => {
      if (walletAPI.isOnline()) {
        try {
          const result = await walletAPI.syncCachedTransactions();
          if (result && result.synced > 0) {
            Alert.alert(
              'Transactions Synced! 🔄',
              `${result.synced} cached transactions have been synced successfully.`,
              [{ text: 'OK', onPress: () => loadWalletData() }]
            );
          }
        } catch (error) {
          console.error('❌ Auto-sync failed:', error);
        }
      }
    };

    // Listen for network connectivity changes using NetInfo
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        handleOnlineStatus();
      }
    });

    // Initial sync check on component mount
    handleOnlineStatus();

    // Cleanup on unmount
    return () => {
      walletBalanceListener();
      escrowReleaseListener();
      unsubscribe();
    };
  }, [wallet]);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
      console.log('✅ Profile loaded for wallet screen:', {
        isSeller: profileData.isSeller,
        isRider: profileData.isRider,
      });
    } catch (error) {
      console.error('❌ Error loading profile:', error);
    }
  };

  const loadWalletData = async () => {
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('accessToken');
      
      // Load critical data first, then load optional data
      try {
        const [walletData, statsData] = await Promise.all([
          walletAPI.getWallet(),
          walletAPI.getWalletStats(),
        ]);
        
        setWallet(walletData);
        setWalletStats(statsData);

        // ✅ Extract pending escrows from wallet data (already included in getWallet response)
        if (walletData) {
          setPendingEscrows({
            vendorAmount: walletData.pendingVendorEarnings || 0,
            riderAmount: walletData.pendingRiderEarnings || 0,
            totalPending: walletData.totalPendingEarnings || 0,
          });
          console.log('💰 Pending escrows loaded:', {
            vendor: walletData.pendingVendorEarnings,
            rider: walletData.pendingRiderEarnings,
            total: walletData.totalPendingEarnings,
          });
        }
      } catch (criticalError) {
        console.error('❌ Failed to load critical wallet data:', criticalError);
        throw criticalError;
      }

      // Load transaction history separately (non-blocking)
      try {
        const transactionsData = await walletAPI.getTransactionHistory({ limit: 50 });
        setTransactions(transactionsData);
      } catch (transactionError) {
        console.warn('⚠️ Failed to load transaction history:', transactionError);
        // Continue without transaction history - not critical for basic wallet functionality
        setTransactions([]);
      }

      // Load rewards separately with error handling
      try {
        const rewardsData = await rewardsAPI.getWalletDisplayRewards();
        setRewards(rewardsData);
      } catch (rewardsError) {
        console.warn('⚠️  Rewards data unavailable:', rewardsError);
        // Continue without rewards - not critical
        setRewards(null);
      }
    } catch (error: any) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };


  const getDisplayBalance = () => {
    if (!wallet || !walletStats) return { main: '₣0.000000', secondary: '$0.00' };
    
    if (selectedCurrency === 'FRETI' || !showLocalEquivalent) {
      return {
        main: walletAPI.formatFreti(wallet.availableBalance),
        secondary: walletAPI.formatCurrency(walletStats.localCurrencyEquivalent.available, walletStats.localCurrencyEquivalent.currency)
      };
    } else {
      return {
        main: walletAPI.formatCurrency(walletStats.localCurrencyEquivalent.available, walletStats.localCurrencyEquivalent.currency),
        secondary: walletAPI.formatFreti(wallet.availableBalance)
      };
    }
  };

  const renderTransaction = ({ item }: { item: WalletTransaction }) => {
    const typeInfo = walletAPI.getTransactionTypeDisplay(item.transactionType);
    const availableDelta = item.availableDelta ?? 0;
    const availableBalanceAfter = item.availableBalanceAfter ?? 0;
    const isPositive = availableDelta > 0;
    
    return (
      <TouchableOpacity style={styles.transactionCard}>
        <View style={[styles.transactionIcon, { backgroundColor: typeInfo.color }]}>
          <Ionicons name={typeInfo.icon as any} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>{typeInfo.label}</Text>
          <Text style={styles.transactionDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          {item.description && (
            <Text style={styles.transactionDescription}>{item.description}</Text>
          )}
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[styles.transactionAmountText, { color: isPositive ? '#27AE60' : '#E74C3C' }]}>
            {isPositive ? '+' : ''}{walletAPI.formatFreti(availableDelta)}
          </Text>
          <Text style={styles.transactionBalance}>
            Bal: {walletAPI.formatFreti(availableBalanceAfter)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Wallet...</Text>
        </View>
      </View>
    );
  }

  const balanceDisplay = getDisplayBalance();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <TouchableOpacity onPress={() => setShowCurrencySelector(true)} style={styles.currencyButton}>
          <Text style={styles.currencyText}>{selectedCurrency}</Text>
          <Ionicons name="chevron-down" size={16} color="#F39C12" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F39C12" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Balance Card */}
        <View style={styles.balanceCard}>
          <TouchableOpacity 
            style={styles.balanceToggle}
            onPress={() => setShowLocalEquivalent(!showLocalEquivalent)}
          >
            <Ionicons name="swap-horizontal" size={20} color="#F39C12" />
          </TouchableOpacity>
          
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceMain}>{balanceDisplay.main}</Text>
          <Text style={styles.balanceSecondary}>{balanceDisplay.secondary}</Text>
          
          {/* KYC Status Indicator */}
          <View style={[styles.kycBadge, { 
            backgroundColor: wallet?.kycStatus === 'approved' ? '#27AE60' : 
                           wallet?.kycStatus === 'rejected' ? '#E74C3C' : '#F39C12' 
          }]}>
            <Text style={styles.kycText}>
              KYC: {wallet?.kycStatus?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>

        {/* Additional Balances */}
        {walletStats && wallet && (wallet.escrowBalance > 0 || wallet.pendingWithdrawal > 0) && (
          <View style={styles.additionalBalancesCard}>
            <Text style={styles.sectionTitle}>Other Balances</Text>
            <View style={styles.additionalBalancesGrid}>
              {wallet.escrowBalance > 0 && (
                <View style={styles.escrowBalanceCard}>
                  <Text style={styles.additionalLabel}>In Escrow</Text>
                  <Text style={styles.additionalAmount}>
                    {walletAPI.formatFreti(wallet.escrowBalance)}
                  </Text>
                  <Text style={styles.additionalSecondary}>
                    {walletAPI.formatCurrency(walletStats.localCurrencyEquivalent.escrow, walletStats.localCurrencyEquivalent.currency)}
                  </Text>
                </View>
              )}
              {wallet.pendingWithdrawal > 0 && (
                <View style={styles.pendingBalanceCard}>
                  <Text style={styles.additionalLabel}>Pending Withdrawal</Text>
                  <Text style={styles.additionalAmount}>
                    {walletAPI.formatFreti(wallet.pendingWithdrawal)}
                  </Text>
                  <Text style={styles.additionalSecondary}>
                    {walletAPI.formatCurrency(walletStats.localCurrencyEquivalent.pending, walletStats.localCurrencyEquivalent.currency)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ✅ NEW: Pending Earnings Section */}
        {pendingEscrows && pendingEscrows.totalPending > 0 && (
          <View style={styles.pendingEarningsCard}>
            <View style={styles.rewardsHeader}>
              <Text style={styles.sectionTitle}>Pending Earnings 🔒</Text>
              <TouchableOpacity onPress={() => Alert.alert('Pending Earnings', 'These funds are held in escrow and will be released 24 hours after delivery confirmation.')}>
                <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.pendingEarningsRow}>
              {/* Only show vendor earnings if user is a vendor (not a rider) */}
              {profile?.isSeller && !profile?.isRider && pendingEscrows.vendorAmount > 0 && (
                <View style={styles.pendingEarningItem}>
                  <Ionicons name="storefront-outline" size={24} color="#F39C12" />
                  <Text style={styles.pendingEarningLabel}>Vendor Earnings</Text>
                  <Text style={styles.pendingEarningAmount}>
                    {walletAPI.formatFreti(pendingEscrows.vendorAmount)}
                  </Text>
                  <Text style={styles.pendingEarningSubtext}>Held in escrow</Text>
                </View>
              )}
              
              {/* Only show rider earnings if user is a rider (not a vendor) */}
              {profile?.isRider && !profile?.isSeller && pendingEscrows.riderAmount > 0 && (
                <View style={styles.pendingEarningItem}>
                  <Ionicons name="bicycle-outline" size={24} color="#27AE60" />
                  <Text style={styles.pendingEarningLabel}>Delivery Fees</Text>
                  <Text style={styles.pendingEarningAmount}>
                    {walletAPI.formatFreti(pendingEscrows.riderAmount)}
                  </Text>
                  <Text style={styles.pendingEarningSubtext}>Held in escrow</Text>
                </View>
              )}
            </View>

            <View style={styles.pendingEarningsTotalRow}>
              <Text style={styles.pendingEarningsTotal}>Total Pending</Text>
              <Text style={styles.pendingEarningsTotalAmount}>
                {walletAPI.formatFreti(pendingEscrows.totalPending)}
              </Text>
            </View>

            <View style={styles.pendingEarningsInfo}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.pendingEarningsInfoText}>
                Funds release 24hrs after delivery
              </Text>
            </View>
          </View>
        )}

        {/* Rewards Section */}
        {rewards && (
          <View style={styles.rewardsCard}>
            <View style={styles.rewardsHeader}>
              <Text style={styles.sectionTitle}>Rewards ⭐</Text>
              <TouchableOpacity onPress={() => Alert.alert('Rewards Info', 'Earn 1% rewards on all monthly transactions!')}>
                <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            
            {/* Available Rewards */}
            <View style={styles.rewardsBalanceRow}>
              <View style={styles.rewardsBalanceItem}>
                <Text style={styles.rewardsLabel}>Available</Text>
                <Text style={styles.rewardsAmount}>{rewards.display_available}</Text>
                <Text style={styles.rewardsSubtext}>Ready to use</Text>
              </View>
              
              {rewards.has_pending && (
                <View style={styles.rewardsBalanceItem}>
                  <Text style={styles.rewardsLabel}>Pending</Text>
                  <Text style={styles.rewardsPendingAmount}>{rewards.display_pending}</Text>
                  <Text style={styles.rewardsSubtext}>Available {rewardsAPI.formatNextCreditDate()}</Text>
                </View>
              )}
            </View>

            {/* Current Month Progress */}
            <View style={styles.monthlyProgressCard}>
              <Text style={styles.progressTitle}>This Month's Progress</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Transactions</Text>
                  <Text style={styles.progressValue}>
                    {walletAPI.formatFreti(rewards.current_month_progress.transaction_amount)}
                  </Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Est. Rewards</Text>
                  <Text style={styles.progressValue}>
                    {rewards.current_month_progress.display_estimated}
                  </Text>
                </View>
              </View>
              <View style={styles.progressInfo}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.progressInfoText}>
                  Rewards credited on {rewardsAPI.formatNextCreditDate()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('WalletDeposit')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#27AE60' }]}>
                <MaterialIcons name="add" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Deposit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('WalletWithdraw')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E67E22' }]}>
                <MaterialIcons name="remove" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Withdraw</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('WalletHistory')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3498DB' }]}>
                <MaterialIcons name="history" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('AccountSettings')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9B59B6' }]}>
                <MaterialIcons name="settings" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('WalletHistory')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {transactions.length > 0 ? (
            <FlatList
              data={transactions.slice(0, 5)}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noTransactions}>
              <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.noTransactionsText}>No transactions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Currency Selector Modal */}
      <Modal transparent visible={showCurrencySelector} animationType="slide">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setShowCurrencySelector(false)}
        >
          <View style={styles.currencyModal}>
            <Text style={styles.modalTitle}>Select Currency View</Text>
            {currencies.map(currency => (
              <TouchableOpacity
                key={currency}
                style={styles.currencyOption}
                onPress={() => {
                  setSelectedCurrency(currency);
                  setShowCurrencySelector(false);
                }}
              >
                <Text style={styles.currencyOptionText}>{currency}</Text>
                {selectedCurrency === currency && (
                  <Ionicons name="checkmark" size={20} color="#F39C12" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  currencyText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  balanceToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceMain: {
    color: '#F39C12',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 4,
  },
  balanceSecondary: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  kycBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  kycText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  additionalBalancesCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  additionalBalancesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  escrowBalanceCard: {
    flex: 1,
    backgroundColor: 'rgba(230, 126, 34, 0.2)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(230, 126, 34, 0.3)',
  },
  pendingBalanceCard: {
    flex: 1,
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  additionalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  additionalAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  additionalSecondary: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  actionsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  transactionDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionBalance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '500',
  },
  noTransactions: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noTransactionsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyModal: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    width: 200,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  currencyOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Rewards styles
  rewardsCard: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardsBalanceRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  rewardsBalanceItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  rewardsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rewardsAmount: {
    color: '#F39C12',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  rewardsPendingAmount: {
    color: '#E67E22',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  rewardsSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  monthlyProgressCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  progressValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  progressInfoText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  // ✅ NEW: Pending Earnings styles
  pendingEarningsCard: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  pendingEarningsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pendingEarningItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  pendingEarningLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  pendingEarningAmount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.6, // Faded to show it's locked
    textAlign: 'center',
  },
  pendingEarningSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  pendingEarningsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  pendingEarningsTotal: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingEarningsTotalAmount: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.6, // Faded to show it's locked
  },
  pendingEarningsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pendingEarningsInfoText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
});

export { WalletScreen };