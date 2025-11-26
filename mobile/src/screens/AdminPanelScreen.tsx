import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as adminApi from '../services/api/adminApi';
import { useToast } from '../components/ToastProvider';

interface AdminSummary {
  totalUsers: number;
  totalPayouts: number;
  activeMiners: number;
}

const AdminPanelScreen = () => {
  const [summary, setSummary] = useState<AdminSummary | undefined>();
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await adminApi.fetchSummary();
        setSummary(response?.summary ?? response);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load admin data', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [show]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : summary ? (
        <Card title="Admin Panel">
          <Text style={styles.text}>Total Users: {summary.totalUsers}</Text>
          <Text style={styles.text}>Active Miners: {summary.activeMiners}</Text>
          <Text style={styles.text}>Total Payouts: ${summary.totalPayouts}</Text>
        </Card>
      ) : (
        <Text style={styles.text}>No admin data available.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body, marginBottom: spacing.xs }
});

export default AdminPanelScreen;
