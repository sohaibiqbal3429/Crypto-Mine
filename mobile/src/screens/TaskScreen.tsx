import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const TaskScreen = () => (
  <View style={styles.container}>
    <Card title="Tasks">
      <Text style={styles.text}>Pull tasks from /tasks and render as checklist or cards.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default TaskScreen;
