import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const TeamScreen = () => (
  <View style={styles.container}>
    <Card title="Team">
      <Text style={styles.text}>Render referrals/team hierarchy in a list or accordion.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default TeamScreen;
