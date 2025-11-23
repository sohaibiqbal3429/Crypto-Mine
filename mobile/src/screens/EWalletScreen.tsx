import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const EWalletScreen = () => (
  <View style={styles.container}>
    <Card title="E-Wallet">
      <Text style={styles.text}>Show available internal wallet balances and transfer actions.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default EWalletScreen;
