import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';

const DepositScreen = () => {
  return (
    <View style={styles.container}>
      <Card title="Deposit">
        <Text style={styles.text}>Use the MintMinePro web deposit methods. This screen can display QR codes or bank details pulled from /wallet/deposit-methods.</Text>
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
    fontSize: typography.body
  }
});

export default DepositScreen;
