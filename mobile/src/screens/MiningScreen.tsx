import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchMiningStatus, startMining } from '../store/slices/miningSlice';
import { colors, spacing, typography } from '../styles/theme';
import { Card } from '../components/Card';
import { useToast } from '../components/ToastProvider';

const MiningScreen = () => {
  const dispatch = useAppDispatch();
  const mining = useAppSelector((state) => state.mining);
  const { show } = useToast();

  useEffect(() => {
    dispatch(fetchMiningStatus());
  }, [dispatch]);

  const onStart = async () => {
    try {
      await dispatch(startMining()).unwrap();
      show('Mining started', 'success');
    } catch (error: any) {
      show(error?.message ?? 'Unable to start mining', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Card title="Mining">
        {mining.loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.text}>Status: {mining.status}</Text>
            <Text style={styles.text}>Next window: {mining.nextWindow ?? 'Ready to mine'}</Text>
            <Button title="Start Mining" onPress={onStart} disabled={mining.status === 'mining'} />
          </>
        )}
      </Card>
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
    marginBottom: spacing.sm,
    fontSize: typography.body
  }
});

export default MiningScreen;
