import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletAPI, WalletTransaction } from '../services/walletAPI';

interface WalletHistoryScreenProps {
  navigation: any;
}

const WalletHistoryScreen = ({ navigation }: WalletHistoryScreenProps) => {
  const insets = useSafeAreaInsets();
  
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadTransactions();
  }, [filterType]);

  const loadTransactions = async () => {
    try {
      const params = filterType === 'all' ? { limit: 50 } : { type: filterType, limit: 50 };
      const data = await walletAPI.getTransactionHistory(params);
      setTransactions(data);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transaction history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'deposit_mint', label: 'Deposits' },
    { key: 'withdrawal_burn', label: 'Withdrawals' },
    { key: 'purchase_hold', label: 'Purchases' },
    { key: 'escrow_release', label: 'Escrow' },
    { key: 'reward_credit', label: 'Rewards' },
  ];

  const renderTransaction = ({ item, index }: { item: WalletTransaction; index: number }) => {
    const typeInfo = walletAPI.getTransactionTypeDisplay(item.transactionType);
    const isPositive = item.availableDelta > 0;
    const date = new Date(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={[styles.transactionCard, index === 0 && styles.firstTransaction]}
        onPress={() => {
          Alert.alert(
            'Transaction Details',
            `Type: ${typeInfo.label}\nAmount: ${walletAPI.formatFreti(item.availableDelta)}\nBalance After: ${walletAPI.formatFreti(item.availableBalanceAfter)}\nDate: ${date.toLocaleString()}\n${item.description ? `\nDescription: ${item.description}` : ''}\n${item.referenceId ? `Reference ID: ${item.referenceId}` : ''}`,
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
              {isPositive ? '+' : ''}{walletAPI.formatFreti(item.availableDelta)}
            </Text>
          </View>
          
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.transactionBalance}>
              Balance: {walletAPI.formatFreti(item.availableBalanceAfter)}
            </Text>
          </View>
          
          {item.description && (
            <Text style={styles.transactionDescription}>{item.description}</Text>
          )}
          
          {/* Show delta changes for escrow and pending if they exist */}
          {(item.escrowDelta !== 0 || item.pendingWithdrawalDelta !== 0) && (
            <View style={styles.deltaContainer}>
              {item.escrowDelta !== 0 && (
                <Text style={styles.deltaText}>
                  Escrow: {item.escrowDelta > 0 ? '+' : ''}{walletAPI.formatFreti(item.escrowDelta)}
                </Text>
              )}
              {item.pendingWithdrawalDelta !== 0 && (
                <Text style={styles.deltaText}>
                  Pending: {item.pendingWithdrawalDelta > 0 ? '+' : ''}{walletAPI.formatFreti(item.pendingWithdrawalDelta)}
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

      {/* Filter Options */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filterOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => renderFilterButton(item)}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Transactions List */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        style={styles.transactionsList}
        contentContainerStyle={[
          styles.transactionsContainer,
          { paddingBottom: insets.bottom + 20 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F39C12"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptySubtitle}>
              {filterType === 'all' 
                ? 'Your transaction history will appear here'
                : `No ${filterOptions.find(f => f.key === filterType)?.label.toLowerCase()} transactions found`
              }
            </Text>
          </View>
        }
      />
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
  filtersContainer: {
    paddingVertical: 16,
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
  transactionArrow: {
    marginLeft: 8,
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
});

export { WalletHistoryScreen };