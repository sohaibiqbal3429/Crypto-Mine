import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const SupportScreen = () => (
  <View style={styles.container}>
    <Card title="Support">
      <Text style={styles.text}>Link to support chat, email, or ticket endpoints.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default SupportScreen;
