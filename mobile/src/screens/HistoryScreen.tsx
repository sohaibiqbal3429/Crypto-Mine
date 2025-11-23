import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as walletApi from '../services/api/walletApi';
import { useToast } from '../components/ToastProvider';

interface HistoryItem {
  id: string;
  type: 'withdraw';
  amount: number;
  status: string;
  createdAt: string;
}

const HistoryScreen = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await walletApi.fetchHistory();
        const mapped: HistoryItem[] = response.withdrawals?.map((entry) => ({
          id: entry._id,
          type: 'withdraw',
          amount: entry.amount,
          status: entry.status,
          createdAt: entry.createdAt,
        })) ?? [];
        setHistory(mapped);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load history', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [show]);

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <Card title={`${item.type.toUpperCase()} • ${item.status}`}> 
      <Text style={styles.text}>Amount: ${item.amount}</Text>
      <Text style={styles.subText}>{new Date(item.createdAt).toLocaleString()}</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>History</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.text}>No history available yet.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  heading: { fontSize: typography.heading, fontWeight: '700', marginBottom: spacing.md, color: colors.text },
  text: { color: colors.text, fontSize: typography.body },
  subText: { color: colors.textMuted, marginTop: spacing.xs }
});

export default HistoryScreen;
