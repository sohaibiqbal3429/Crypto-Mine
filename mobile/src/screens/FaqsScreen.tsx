import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const FaqsScreen = () => (
  <View style={styles.container}>
    <Card title="FAQs">
      <Text style={styles.text}>Render FAQs in accordion format for mobile readability.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default FaqsScreen;
