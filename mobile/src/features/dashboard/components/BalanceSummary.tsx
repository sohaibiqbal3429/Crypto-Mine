import { StyleSheet, View, Text } from 'react-native'
import type { DashboardKpis } from '../types/dashboard'

interface BalanceSummaryProps {
  kpis: DashboardKpis
}

export function BalanceSummary({ kpis }: BalanceSummaryProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Metric label="Current Balance" value={kpis.currentBalance} variant="primary" />
        <Metric label="Pending Withdraw" value={kpis.pendingWithdraw} variant="warning" />
      </View>
      <View style={styles.row}>
        <Metric label="Total Withdrawn" value={kpis.totalWithdraw} />
        <Metric label="Team Rewards" value={kpis.teamReward} />
      </View>
    </View>
  )
}

interface MetricProps {
  label: string
  value: number
  variant?: 'default' | 'primary' | 'warning'
}

function Metric({ label, value, variant = 'default' }: MetricProps) {
  const variantStyle = variantStyles[variant]
  return (
    <View style={[styles.metric, variantStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>${value.toFixed(2)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  metric: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    padding: 16
  },
  metricDefault: {
    backgroundColor: '#0f172a'
  },
  metricPrimary: {
    backgroundColor: '#1d4ed8'
  },
  metricWarning: {
    backgroundColor: '#ea580c'
  },
  metricLabel: {
    color: '#cbd5f5',
    fontSize: 14
  },
  metricValue: {
    marginTop: 8,
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold'
  }
})

const variantStyles: Record<NonNullable<MetricProps['variant']>, object> = {
  default: styles.metricDefault,
  primary: styles.metricPrimary,
  warning: styles.metricWarning
}
