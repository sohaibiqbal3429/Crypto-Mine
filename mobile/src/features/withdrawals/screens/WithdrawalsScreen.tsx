import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useWithdrawalsQuery } from '@/features/withdrawals/api'
import type { WithdrawalEntry } from '@/features/withdrawals/types/withdrawals'

function renderWithdrawal(item: WithdrawalEntry) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
        <Text style={[styles.status, statusStyles[item.status] ?? styles.statusPending]}>{item.status}</Text>
      </View>
      <Text style={styles.metaLabel}>Requested</Text>
      <Text style={styles.metaValue}>{new Date(item.createdAt).toLocaleString()}</Text>
    </View>
  )
}

const statusStyles: Record<string, any> = {
  approved: { color: '#4ade80' },
  pending: { color: '#facc15' },
  rejected: { color: '#f87171' }
}

export function WithdrawalsScreen() {
  const { data, isLoading, isRefetching, refetch } = useWithdrawalsQuery()

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data?.withdrawals ?? []}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => renderWithdrawal(item)}
      refreshControl={<RefreshControl refreshing={isLoading || isRefetching} onRefresh={handleRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Withdrawal History</Text>
          <Text style={styles.subtitle}>Track every payout request and approval.</Text>
        </View>
      }
      ListEmptyComponent={
        !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No withdrawals yet</Text>
            <Text style={styles.emptySubtitle}>Initiate a withdrawal from the dashboard to see it listed here.</Text>
          </View>
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#020617'
  },
  listContent: {
    padding: 16,
    gap: 12
  },
  header: {
    marginBottom: 8
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '600'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111827',
    gap: 4
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  amount: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700'
  },
  status: {
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  statusPending: {
    color: '#facc15'
  },
  metaLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8
  },
  metaValue: {
    color: '#cbd5f5',
    fontSize: 14
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 8
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600'
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24
  }
})
