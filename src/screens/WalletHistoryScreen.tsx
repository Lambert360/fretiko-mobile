import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletAPI, WalletTransaction, SaleTransaction } from '../services/walletAPI';
import { ordersAPI } from '../services/ordersAPI';
import { rewardsAPI, RewardsTransaction } from '../services/rewardsAPI';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

interface WalletHistoryScreenProps {
  navigation: any;
}

interface UserProfile {
  id: string;
  username: string;
  isSeller: boolean;
  isRider?: boolean;
}

type TabType = 'all' | 'deposits' | 'withdrawals' | 'purchases' | 'escrow' | 'rewards' | 'sales';

const WalletHistoryScreen = ({ navigation }: WalletHistoryScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [rewards, setRewards] = useState<RewardsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Check if user is vendor or rider (from loaded profile)
  const isVendorOrRider = profile?.isSeller || profile?.isRider;

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      loadData(true);
    }
  }, [activeTab, filterType, profile]);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
      console.log('✅ Profile loaded for wallet history:', {
        isSeller: profileData.isSeller,
        isRider: profileData.isRider,
      });
    } catch (error) {
      console.error('❌ Error loading profile:', error);
    }
  };

  const loadData = async (reset: boolean = false) => {
    try {
      if (reset) {
        setOffset(0);
        setHasMore(true);
        setLoading(true);
      }

      const currentOffset = reset ? 0 : offset;

      if (activeTab === 'sales') {
        // Load sales history
        const params: any = { limit: 20, offset: currentOffset };
        
        if (filterType !== 'all') {
          params.type = filterType;
        }

        const response = await walletAPI.getSalesHistory(params);
        
        if (reset) {
          setSales(response.sales);
        } else {
          setSales(prev => [...prev, ...response.sales]);
        }

        setOffset(currentOffset + response.sales.length);
        setHasMore(response.sales.length === 20);
      } else if (activeTab === 'rewards') {
        // Load rewards history
        const params: any = { limit: 50, offset: currentOffset };
        
        if (filterType !== 'all') {
          params.type = filterType;
        }

        const response = await rewardsAPI.getRewardsHistory(params);
        
        if (reset) {
          setRewards(response.transactions);
        } else {
          setRewards(prev => [...prev, ...response.transactions]);
        }

        setOffset(currentOffset + response.transactions.length);
        setHasMore(response.transactions.length === 50);
      } else {
        // Load wallet transactions from backend
        const params: any = { limit: 50, offset: currentOffset };
        
        // Set type based on active tab
        if (activeTab === 'deposits') {
          params.type = 'deposit_mint';
        } else if (activeTab === 'withdrawals') {
          params.type = 'withdrawal_burn';
        } else if (activeTab === 'purchases') {
          params.type = 'purchase_hold';
        } else if (activeTab === 'escrow') {
          // Show escrow data - vendors see both buyer and vendor transactions
          const holdParams = { ...params, type: 'purchase_hold' };
          const releaseParams = { ...params, type: 'escrow_release' };
          const refundParams = { ...params, type: 'escrow_refund' };
          const vendorSaleParams = { ...params, type: 'vendor_sale' };
          const riderDeliveryParams = { ...params, type: 'rider_delivery' };
          
          const [holdData, releaseData, refundData, vendorSaleData, riderDeliveryData] = await Promise.all([
            walletAPI.getTransactionHistory(holdParams),
            walletAPI.getTransactionHistory(releaseParams),
            walletAPI.getTransactionHistory(refundParams),
            walletAPI.getTransactionHistory(vendorSaleParams),
            walletAPI.getTransactionHistory(riderDeliveryParams)
          ]);
          
          // Merge and sort by date, removing duplicates by ID
          const allTransactions = [...holdData, ...releaseData, ...refundData, ...vendorSaleData, ...riderDeliveryData];
          
          // Deduplicate by transaction ID to prevent duplicate key errors
          const uniqueTransactionsMap = new Map();
          allTransactions.forEach(transaction => {
            if (transaction.id && !uniqueTransactionsMap.has(transaction.id)) {
              uniqueTransactionsMap.set(transaction.id, transaction);
            }
          });
          
          const mergedData = Array.from(uniqueTransactionsMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Log warning if duplicates were found (for debugging)
          if (allTransactions.length !== mergedData.length) {
            console.warn(`⚠️ Duplicate transactions detected: ${allTransactions.length - mergedData.length} duplicates removed`);
          }
          
          if (reset) {
            setTransactions(mergedData);
          } else {
            // Also deduplicate when appending to prevent duplicates from pagination
            setTransactions(prev => {
              const prevMap = new Map(prev.map(t => [t.id, t]));
              mergedData.forEach(t => {
                if (t.id && !prevMap.has(t.id)) {
                  prevMap.set(t.id, t);
                }
              });
              return Array.from(prevMap.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          }
          
          setOffset(currentOffset + mergedData.length);
          setHasMore(holdData.length === 50 || releaseData.length === 50 || refundData.length === 50 || vendorSaleData.length === 50 || riderDeliveryData.length === 50);
          
          // Skip the normal data fetch below
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          return;
        } else if (activeTab === 'all' && filterType !== 'all') {
          // Only apply filter when on "All" tab
          params.type = filterType;
        }

        const data = await walletAPI.getTransactionHistory(params);
        
        if (reset) {
          setTransactions(data);
        } else {
          setTransactions(prev => [...prev, ...data]);
        }

        setOffset(currentOffset + data.length);
        setHasMore(data.length === 50);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadData(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Reset filter when changing tabs
    setFilterType('all');
    setOffset(0);
    setHasMore(true);
  };

  const salesFilterOptions = [
    { key: 'all', label: 'All Sales' },
    { key: 'vendor_sale', label: 'Vendor Sales' },
    { key: 'rider_delivery', label: 'Delivery Fees' },
  ];

  const transactionFilterOptions = [
    { key: 'all', label: 'All' },
    { key: 'deposit_mint', label: 'Deposits' },
    { key: 'withdrawal_burn', label: 'Withdrawals' },
    { key: 'purchase_hold', label: 'Purchases' },
    { key: 'escrow_release', label: 'Escrow' },
    { key: 'reward_credit', label: 'Rewards' },
  ];

  const renderTransaction = ({ item, index }: { item: WalletTransaction; index: number }) => {
    const typeInfo = walletAPI.getTransactionTypeDisplay(item.transactionType);
    const availableDelta = item.availableDelta ?? 0;
    const availableBalanceAfter = item.availableBalanceAfter ?? 0;
    const escrowDelta = item.escrowDelta ?? 0;
    const pendingWithdrawalDelta = item.pendingWithdrawalDelta ?? 0;
    const isPositive = availableDelta > 0;
    const date = new Date(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={[styles.transactionCard, index === 0 && styles.firstTransaction]}
        onPress={() => {
          Alert.alert(
            'Transaction Details',
            `Type: ${typeInfo.label}\nAmount: ${walletAPI.formatFreti(availableDelta)}\nBalance After: ${walletAPI.formatFreti(availableBalanceAfter)}\nDate: ${date.toLocaleString()}\n${item.description ? `\nDescription: ${item.description}` : ''}\n${item.referenceId ? `Reference ID: ${item.referenceId}` : ''}`,
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={[styles.transactionIcon, { backgroundColor: typeInfo.color }]}>
          <Ionicons name={typeInfo.icon as any} size={20} color="#FFFFFF" />
        </View>
        
        <View style={styles.transactionDetails}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>{typeInfo.label}</Text>
            <Text style={[
              styles.transactionAmount, 
              { color: isPositive ? '#27AE60' : '#E74C3C' }
            ]}>
              {isPositive ? '+' : ''}{walletAPI.formatFreti(availableDelta)}
            </Text>
          </View>
          
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.transactionBalance}>
              Balance: {walletAPI.formatFreti(availableBalanceAfter)}
            </Text>
          </View>
          
          {item.description && (
            <Text style={styles.transactionDescription}>{item.description}</Text>
          )}
          
          {/* Show delta changes for escrow and pending if they exist */}
          {(escrowDelta !== 0 || pendingWithdrawalDelta !== 0) && (
            <View style={styles.deltaContainer}>
              {escrowDelta !== 0 && (
                <Text style={styles.deltaText}>
                  Escrow: {escrowDelta > 0 ? '+' : ''}{walletAPI.formatFreti(escrowDelta)}
                </Text>
              )}
              {pendingWithdrawalDelta !== 0 && (
                <Text style={styles.deltaText}>
                  Pending: {pendingWithdrawalDelta > 0 ? '+' : ''}{walletAPI.formatFreti(pendingWithdrawalDelta)}
                </Text>
              )}
            </View>
          )}
          
          {item.referenceId && (
            <Text style={styles.referenceId}>Ref: {item.referenceId.substring(0, 8)}...</Text>
          )}
        </View>
        
        <View style={styles.transactionArrow}>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </TouchableOpacity>
    );
  };

  // Escrow-specific header (totals and legend)
  const renderEscrowHeader = () => {
    const totals = transactions.reduce(
      (acc, t) => {
        // Count all escrow-related transactions
        if (t.transactionType === 'purchase_hold') acc.held += Math.abs(t.escrowDelta || 0) || Math.abs(t.availableDelta || 0);
        if (t.transactionType === 'escrow_release') acc.released += Math.abs(t.availableDelta || 0);
        if (t.transactionType === 'escrow_refund') acc.refunded += Math.abs(t.availableDelta || 0);
        if (t.transactionType === 'vendor_sale') acc.vendorSales += Math.abs(t.availableDelta || 0);
        if (t.transactionType === 'rider_delivery') acc.riderEarnings += Math.abs(t.availableDelta || 0);
        return acc;
      },
      { held: 0, released: 0, refunded: 0, vendorSales: 0, riderEarnings: 0 }
    );

    return (
      <View style={styles.escrowHeader}>
        <View style={styles.escrowTotalsRow}>
          {/* Show all escrow transaction types */}
          <View style={[styles.escrowPill, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)' }]}>
            <Ionicons name="lock-closed" size={14} color="#3B82F6" />
            <Text style={[styles.escrowPillText, { color: '#3B82F6' }]}>Held</Text>
            <Text style={[styles.escrowPillAmount, { color: '#3B82F6' }]}>{walletAPI.formatFreti(totals.held)}</Text>
          </View>
          <View style={[styles.escrowPill, { backgroundColor: 'rgba(39,174,96,0.15)', borderColor: 'rgba(39,174,96,0.35)' }]}>
            <Ionicons name="checkmark-done" size={14} color="#27AE60" />
            <Text style={[styles.escrowPillText, { color: '#27AE60' }]}>Released</Text>
            <Text style={[styles.escrowPillAmount, { color: '#27AE60' }]}>{walletAPI.formatFreti(totals.released)}</Text>
          </View>
          <View style={[styles.escrowPill, { backgroundColor: 'rgba(231,76,60,0.15)', borderColor: 'rgba(231,76,60,0.35)' }]}>
            <Ionicons name="refresh" size={14} color="#E74C3C" />
            <Text style={[styles.escrowPillText, { color: '#E74C3C' }]}>Refunded</Text>
            <Text style={[styles.escrowPillAmount, { color: '#E74C3C' }]}>{walletAPI.formatFreti(totals.refunded)}</Text>
          </View>
          {isVendorOrRider && (
            <>
              <View style={[styles.escrowPill, { backgroundColor: 'rgba(243,156,18,0.15)', borderColor: 'rgba(243,156,18,0.35)' }]}>
                <Ionicons name="cash" size={14} color="#F39C12" />
                <Text style={[styles.escrowPillText, { color: '#F39C12' }]}>Sales</Text>
                <Text style={[styles.escrowPillAmount, { color: '#F39C12' }]}>{walletAPI.formatFreti(totals.vendorSales)}</Text>
              </View>
              {profile?.isRider && (
                <View style={[styles.escrowPill, { backgroundColor: 'rgba(155,89,182,0.15)', borderColor: 'rgba(155,89,182,0.35)' }]}>
                  <Ionicons name="bicycle" size={14} color="#9B59B6" />
                  <Text style={[styles.escrowPillText, { color: '#9B59B6' }]}>Delivery</Text>
                  <Text style={[styles.escrowPillAmount, { color: '#9B59B6' }]}>{walletAPI.formatFreti(totals.riderEarnings)}</Text>
                </View>
              )}
            </>
          )}
        </View>
        <View style={styles.escrowLegend}>
          {/* Show all escrow transaction types */}
          <View style={styles.escrowLegendItem}>
            <View style={[styles.escrowLegendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.escrowLegendText}>Purchase Hold (into escrow)</Text>
          </View>
          <View style={styles.escrowLegendItem}>
            <View style={[styles.escrowLegendDot, { backgroundColor: '#27AE60' }]} />
            <Text style={styles.escrowLegendText}>Escrow Release (to vendor/rider)</Text>
          </View>
          <View style={styles.escrowLegendItem}>
            <View style={[styles.escrowLegendDot, { backgroundColor: '#E74C3C' }]} />
            <Text style={styles.escrowLegendText}>Escrow Refund (back to buyer)</Text>
          </View>
          {isVendorOrRider && (
            <>
              <View style={styles.escrowLegendItem}>
                <View style={[styles.escrowLegendDot, { backgroundColor: '#F39C12' }]} />
                <Text style={styles.escrowLegendText}>Vendor Sales (earnings)</Text>
              </View>
              {profile?.isRider && (
                <View style={styles.escrowLegendItem}>
                  <View style={[styles.escrowLegendDot, { backgroundColor: '#9B59B6' }]} />
                  <Text style={styles.escrowLegendText}>Delivery Fees (earnings)</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  // Escrow-specific renderer
  const renderEscrowTransaction = ({ item, index }: { item: WalletTransaction; index: number }) => {
    const isHold = item.transactionType === 'purchase_hold';
    const isRelease = item.transactionType === 'escrow_release';
    const isRefund = item.transactionType === 'escrow_refund';
    const date = new Date(item.createdAt);
    const title = isHold ? 'Escrow Hold' : isRelease ? 'Escrow Released' : 'Escrow Refunded';
    const color = isHold ? '#3B82F6' : isRelease ? '#27AE60' : '#E74C3C';
    const icon = isHold ? 'lock-closed' : isRelease ? 'checkmark-done' : 'refresh';
    const amount = isHold ? (item.escrowDelta || Math.abs(item.availableDelta || 0)) : Math.abs(item.availableDelta || 0);

    const handleDispute = async () => {
      if (!item.referenceId) {
        Alert.alert('Unavailable', 'Missing order reference for this transaction.');
        return;
      }
      Alert.alert(
        'Dispute Order',
        'Open a chat with Customer Care about this order?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Chat',
            onPress: () => {
              // Navigate to customer care chat, passing context
              // Assumes a Chat screen that can accept a system/customer care recipient
              (navigation as any).navigate('Chat', {
                recipientId: 'customer_care',
                recipientName: 'Customer Care',
                orderId: item.referenceId,
                subject: 'Order dispute',
              });
            },
          },
        ]
      );
    };

    const handleCancel = async () => {
      if (!item.referenceId) {
        Alert.alert('Unavailable', 'Missing order reference for this transaction.');
        return;
      }
      Alert.alert(
        'Cancel Order & Refund',
        'Cancel this order and refund escrow (if it has not been accepted, processed, or delivered)?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                // Let backend enforce state checks; provide reason for audit
                await ordersAPI.cancelOrder(item.referenceId, 'Buyer canceled from Escrow tab');
                Alert.alert('Requested', 'Cancellation/refund request submitted.');
                onRefresh();
              } catch (err: any) {
                Alert.alert('Failed', err?.message || 'Unable to cancel. The order may already be accepted or delivered.');
              }
            },
          },
        ]
      );
    };

    return (
      <TouchableOpacity
        style={[styles.escrowCard, index === 0 && styles.firstTransaction]}
        onPress={() => {
          Alert.alert(
            'Escrow Details',
            `${title}\nAmount: ${walletAPI.formatFreti(amount)}\nDate: ${date.toLocaleString()}${item.referenceId ? `\nRef: ${item.referenceId}` : ''}`,
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={[styles.escrowIcon, { backgroundColor: color.replace('1)', '0.1)') }]}> 
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={styles.escrowDetails}>
          <View style={styles.escrowHeaderRow}>
            <Text style={styles.escrowTitle}>{title}</Text>
            <Text style={[styles.escrowAmount, { color }]}>{(isRelease || isRefund) ? '+' : ''}{walletAPI.formatFreti(amount)}</Text>
          </View>
          <View style={styles.escrowMetaRow}>
            <Text style={styles.transactionDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {item.referenceId && (
              <Text style={styles.orderNumber}>Ref {item.referenceId.substring(0, 8)}…</Text>
            )}
          </View>
          <View style={styles.escrowBadgesRow}>
            {isHold && (
              <Text style={[styles.escrowBadge, { backgroundColor: 'rgba(59,130,246,0.12)', color: '#3B82F6', borderColor: 'rgba(59,130,246,0.35)' }]}>Held</Text>
            )}
            {isRelease && (
              <Text style={[styles.escrowBadge, { backgroundColor: 'rgba(39,174,96,0.12)', color: '#27AE60', borderColor: 'rgba(39,174,96,0.35)' }]}>Released</Text>
            )}
            {isRefund && (
              <Text style={[styles.escrowBadge, { backgroundColor: 'rgba(231,76,60,0.12)', color: '#E74C3C', borderColor: 'rgba(231,76,60,0.35)' }]}>Refunded</Text>
            )}
          </View>
          {isHold && (
            <View style={styles.escrowActionsRow}>
              <TouchableOpacity style={[styles.escrowActionBtn, { borderColor: 'rgba(59,130,246,0.35)' }]} onPress={handleDispute}>
                <Ionicons name="chatbubbles-outline" size={14} color="#3B82F6" />
                <Text style={[styles.escrowActionText, { color: '#3B82F6' }]}>Dispute</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.escrowActionBtn, { borderColor: 'rgba(231,76,60,0.35)' }]} onPress={handleCancel}>
                <Ionicons name="close-circle-outline" size={14} color="#E74C3C" />
                <Text style={[styles.escrowActionText, { color: '#E74C3C' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    );
  };

  const renderReward = ({ item, index }: { item: RewardsTransaction; index: number }) => {
    const typeInfo = rewardsAPI.getRewardsTransactionTypeDisplay(item.transactionType);
    const amount = item.availableDelta ?? 0;
    const isPositive = amount > 0;
    const date = new Date(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={[styles.transactionCard, index === 0 && styles.firstTransaction]}
        onPress={() => {
          Alert.alert(
            'Rewards Transaction',
            `Type: ${typeInfo.label}\nAmount: ⭐${Math.abs(amount).toFixed(0)}\nBalance After: ⭐${item.availableBalanceAfter.toFixed(0)}\nDate: ${date.toLocaleString()}\n${item.description ? `\nDescription: ${item.description}` : ''}${item.calculationPeriod ? `\nPeriod: ${item.calculationPeriod}` : ''}`,
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={[styles.transactionIcon, { backgroundColor: typeInfo.color }]}>
          <Ionicons name={typeInfo.icon as any} size={20} color="#FFFFFF" />
        </View>
        
        <View style={styles.transactionDetails}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>{typeInfo.label}</Text>
            <Text style={[
              styles.transactionAmount, 
              { color: isPositive ? '#27AE60' : '#E74C3C' }
            ]}>
              {isPositive ? '+' : ''}⭐{Math.abs(amount).toFixed(0)}
            </Text>
          </View>
          
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.transactionBalance}>
              Balance: ⭐{item.availableBalanceAfter.toFixed(0)}
            </Text>
          </View>
          
          {item.description && (
            <Text style={styles.transactionDescription}>{item.description}</Text>
          )}
          
          {item.calculationPeriod && (
            <Text style={styles.calculationPeriod}>
              Period: {item.calculationPeriod}
            </Text>
          )}
        </View>
        
        <View style={styles.transactionArrow}>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSale = ({ item, index }: { item: SaleTransaction; index: number }) => {
    const typeInfo = walletAPI.getSalesTypeDisplay(item.transactionType);
    const amount = item.amount ?? 0;
    const date = new Date(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={[styles.transactionCard, index === 0 && styles.firstTransaction]}
        onPress={() => {
          Alert.alert(
            'Sale Details',
            `Type: ${typeInfo.label}\nAmount: ${walletAPI.formatFreti(amount)}\n${item.orderNumber ? `Order: #${item.orderNumber}\n` : ''}Date: ${date.toLocaleString()}\n${item.description ? `\nDescription: ${item.description}` : ''}\n\nCumulative Totals:\nVendor Sales: ${walletAPI.formatFreti(item.vendorSalesAfter)}\nRider Earnings: ${walletAPI.formatFreti(item.riderEarningsAfter)}\nLifetime Revenue: ${walletAPI.formatFreti(item.lifetimeRevenueAfter)}`,
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={[styles.transactionIcon, { backgroundColor: typeInfo.color }]}>
          <Ionicons name={typeInfo.icon as any} size={20} color="#FFFFFF" />
        </View>
        
        <View style={styles.transactionDetails}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>{typeInfo.label}</Text>
            <Text style={[styles.transactionAmount, { color: '#27AE60' }]}>
              +{walletAPI.formatFreti(amount)}
            </Text>
          </View>
          
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {item.orderNumber && (
              <Text style={styles.orderNumber}>
                Order #{item.orderNumber}
              </Text>
            )}
          </View>
          
          {item.description && (
            <Text style={styles.transactionDescription}>{item.description}</Text>
          )}
          
          {/* Show cumulative totals */}
          <View style={styles.cumulativeContainer}>
            {item.transactionType === 'vendor_sale' && (
              <Text style={styles.cumulativeText}>
                Total Sales: {walletAPI.formatFreti(item.vendorSalesAfter)}
              </Text>
            )}
            {item.transactionType === 'rider_delivery' && (
              <Text style={styles.cumulativeText}>
                Total Earnings: {walletAPI.formatFreti(item.riderEarningsAfter)}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.transactionArrow}>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (option: { key: string; label: string }) => (
    <TouchableOpacity
      key={option.key}
      style={[
        styles.filterButton,
        filterType === option.key && styles.activeFilterButton
      ]}
      onPress={() => setFilterType(option.key)}
    >
      <Text style={[
        styles.filterButtonText,
        filterType === option.key && styles.activeFilterButtonText
      ]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );

  const tabs = [
    { key: 'all' as TabType, label: 'All', icon: 'list-outline' },
    { key: 'deposits' as TabType, label: 'Deposits', icon: 'add-circle-outline' },
    { key: 'withdrawals' as TabType, label: 'Withdrawals', icon: 'remove-circle-outline' },
    { key: 'purchases' as TabType, label: 'Purchases', icon: 'cart-outline' },
    { key: 'escrow' as TabType, label: 'Escrow', icon: 'shield-checkmark-outline' },
    { key: 'rewards' as TabType, label: 'Rewards', icon: 'star-outline' },
    ...(isVendorOrRider ? [{ key: 'sales' as TabType, label: 'Sales', icon: 'cash-outline' }] : []),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === item.key && styles.activeTab
              ]}
              onPress={() => handleTabChange(item.key)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={16} 
                color={activeTab === item.key ? '#F39C12' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[
                styles.tabText,
                activeTab === item.key && styles.activeTabText
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsList}
        />
      </View>

      {/* Filter Options (only show for 'all' tab or 'sales' tab) */}
      {activeTab === 'all' && (
        <View style={styles.filtersContainer}>
          <FlatList
            data={transactionFilterOptions}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => renderFilterButton(item)}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filtersList}
          />
        </View>
      )}
      {activeTab === 'sales' && (
        <View style={styles.filtersContainer}>
          <FlatList
            data={salesFilterOptions}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => renderFilterButton(item)}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filtersList}
          />
        </View>
      )}

      {/* Content List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F39C12" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={
            activeTab === 'sales' ? sales : 
            activeTab === 'rewards' ? rewards :
            transactions
          }
          renderItem={
            activeTab === 'sales' ? renderSale : 
            activeTab === 'rewards' ? renderReward :
            activeTab === 'escrow' ? renderEscrowTransaction :
            renderTransaction
          }
          keyExtractor={(item, index) => item.id || `transaction-${index}`}
          style={styles.transactionsList}
          contentContainerStyle={[
            styles.transactionsContainer,
            { paddingBottom: insets.bottom + 20 }
          ]}
          ListHeaderComponent={activeTab === 'escrow' ? renderEscrowHeader : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F39C12"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons 
                name={
                  activeTab === 'sales' ? 'cash-outline' : 
                  activeTab === 'purchases' ? 'cart-outline' : 
                  activeTab === 'escrow' ? 'shield-checkmark-outline' :
                  activeTab === 'rewards' ? 'star-outline' :
                  'receipt-outline'
                } 
                size={64} 
                color="rgba(255,255,255,0.3)" 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'sales' ? 'No Sales Yet' : 
                 activeTab === 'purchases' ? 'No Purchases Yet' : 
                 activeTab === 'escrow' ? 'No Escrow Transactions' :
                 activeTab === 'rewards' ? 'No Rewards Yet' :
                 'No Transactions'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'sales' 
                  ? 'Your sales history will appear here once you complete orders'
                  : activeTab === 'purchases'
                  ? 'Your purchase history will appear here when you buy products or services'
                  : activeTab === 'escrow'
                  ? 'Escrow releases and refunds will appear here when orders are completed or disputed'
                  : activeTab === 'rewards'
                  ? 'Your rewards history will appear here. Earn 1% rewards monthly on all transactions!'
                  : 'Your transaction history will appear here'
                }
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#F39C12" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerSpacer: {
    width: 44,
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabsList: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeTab: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  filtersContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filtersList: {
    paddingHorizontal: 16,
  },
  filterButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeFilterButton: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
  filterButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  transactionsList: {
    flex: 1,
  },
  transactionsContainer: {
    paddingTop: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  firstTransaction: {
    marginTop: 8,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  transactionBalance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  calculationPeriod: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  orderNumber: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
  },
  transactionDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 18,
  },
  deltaContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  deltaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  referenceId: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  cumulativeContainer: {
    marginTop: 6,
  },
  cumulativeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(243,156,18,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  transactionArrow: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Escrow styles
  escrowHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  escrowTotalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  escrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  escrowPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  escrowPillAmount: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  escrowLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  escrowLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  escrowLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  escrowLegendText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  escrowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  escrowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(59,130,246,0.1)'
  },
  escrowDetails: {
    flex: 1,
  },
  escrowHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  escrowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  escrowAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  escrowMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  escrowBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  escrowBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  escrowActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  escrowActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  escrowActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export { WalletHistoryScreen };
