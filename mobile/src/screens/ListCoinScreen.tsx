import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as coinApi from '../services/api/coinApi';
import { useToast } from '../components/ToastProvider';

interface Coin {
  id: string;
  name: string;
  symbol: string;
  price?: number;
}

const ListCoinScreen = () => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await coinApi.fetchCoins();
        setCoins(response?.coins ?? response ?? []);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load coins', 'error');
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
      ) : (
        <FlatList
          data={coins}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <Card title={`${item.name} (${item.symbol})`}>
              {item.price !== undefined && <Text style={styles.text}>${item.price.toFixed(4)}</Text>}
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.text}>No coins available.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body }
});

export default ListCoinScreen;
