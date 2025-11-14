import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useDashboardQuery } from '@/features/dashboard/api'
import { BalanceSummary } from '@/features/dashboard/components/BalanceSummary'

export function DashboardScreen() {
  const { data, isLoading, isRefetching, refetch } = useDashboardQuery()

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Mining Dashboard</Text>
      <Text style={styles.subtitle}>Monitor balances, withdrawals, and mining eligibility in real time.</Text>

      {isLoading && !data ? (
        <View style={styles.card}> 
          <Text style={styles.loading}>Loading latest account data…</Text>
        </View>
      ) : data ? (
        <View style={styles.section}>
          <BalanceSummary kpis={data.kpis} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mining Status</Text>
            <Text style={styles.bodyText}>
              {data.mining.canMine
                ? 'You are eligible to run the next mining cycle.'
                : data.mining.requiresDeposit
                  ? `Deposit at least $${data.mining.minDeposit.toFixed(2)} to unlock mining rewards.`
                  : 'Awaiting the next mining window.'}
            </Text>
            <Text style={styles.bodyText}>Next eligible at: {new Date(data.mining.nextEligibleAt).toLocaleString()}</Text>
            <Text style={styles.bodyText}>Earned this cycle: ${data.mining.earnedInCycle.toFixed(2)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Team Overview</Text>
            <Text style={styles.bodyText}>Active partners: {data.kpis.activeMembers}</Text>
            <Text style={styles.bodyText}>Referral code: {data.user.referralCode}</Text>
            <Text style={styles.bodyText}>Lifetime deposits: ${data.user.depositTotal.toFixed(2)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.errorText}>Unable to load dashboard data. Pull to refresh or try again later.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617'
  },
  content: {
    padding: 16,
    gap: 20
  },
  section: {
    gap: 16
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600'
  },
  bodyText: {
    color: '#cbd5f5',
    fontSize: 15
  },
  loading: {
    color: '#cbd5f5',
    fontSize: 16,
    textAlign: 'center'
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 16,
    textAlign: 'center'
  }
})
