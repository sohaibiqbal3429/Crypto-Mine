import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as walletApi from '../services/api/walletApi';
import { useToast } from '../components/ToastProvider';

interface DepositMethod {
  id: string;
  name: string;
  address?: string;
  instructions?: string;
}

const DepositScreen = () => {
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await walletApi.depositMethods();
        const mapped = response.wallets?.map((wallet, index) => ({
          id: `${wallet.address}-${index}`,
          name: wallet.network ? `${wallet.network} Wallet` : 'Primary Wallet',
          address: wallet.address,
        })) ?? [];
        setMethods(mapped);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load deposit methods', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [show]);

  return (
    <View style={styles.container}>
      <Card title="Deposit" style={{ marginBottom: spacing.md }}>
        <Text style={styles.text}>
          Select a deposit option and follow the exact instructions. Funds credit through the existing backend—no extra steps
          needed in the app.
        </Text>
      </Card>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={methods}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <Card title={item.name}>
              {item.address && (
                <Text style={styles.text} selectable>
                  Address: {item.address}
                </Text>
              )}
              {item.instructions && <Text style={[styles.text, { marginTop: spacing.xs }]}>{item.instructions}</Text>}
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.text}>No deposit methods returned.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background
  },
  text: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 20
  }
});

export default DepositScreen;
