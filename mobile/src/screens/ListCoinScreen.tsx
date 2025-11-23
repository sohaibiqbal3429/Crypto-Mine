import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const ListCoinScreen = () => (
  <View style={styles.container}>
    <Card title="Coins">
      <Text style={styles.text}>Display supported coins and rates from the coins endpoint.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default ListCoinScreen;
