import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchWallet } from '../store/slices/walletSlice';
import * as walletApi from '../services/api/walletApi';
import { useToast } from '../components/ToastProvider';

interface DepositMethod {
  id: string;
  name: string;
  address?: string;
}

const EWalletScreen = () => {
  const dispatch = useAppDispatch();
  const wallet = useAppSelector((state) => state.wallet);
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  useEffect(() => {
    const loadMethods = async () => {
      try {
        const response = await walletApi.depositMethods();
        const mapped = response.wallets?.map((wallet, index) => ({
          id: `${wallet.address}-${index}`,
          name: wallet.network ? `${wallet.network} Wallet` : 'Primary Wallet',
          address: wallet.address,
        })) ?? [];
        setMethods(mapped);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load wallets', 'error');
      } finally {
        setLoadingMethods(false);
      }
    };
    loadMethods();
  }, [show]);

  return (
    <View style={styles.container}>
      <Card title="Wallet Balances" style={{ marginBottom: spacing.md }}>
        {wallet.loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.text}>Current Balance: ${wallet.summary.currentBalance}</Text>
            <Text style={styles.text}>Pending Withdraw: ${wallet.summary.pendingWithdraw}</Text>
          </>
        )}
      </Card>
      <Card title="Funding Addresses">
        {loadingMethods ? (
          <ActivityIndicator />
        ) : methods.length ? (
          methods.map((method) => (
            <View key={method.id} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.text}>{method.name}</Text>
              {method.address && (
                <Text style={styles.subText} selectable>
                  {method.address}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.text}>No methods available.</Text>
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body },
  subText: { color: colors.textMuted }
});

export default EWalletScreen;
