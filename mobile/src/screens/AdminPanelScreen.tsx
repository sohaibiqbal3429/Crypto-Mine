import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';

const AdminPanelScreen = () => (
  <View style={styles.container}>
    <Card title="Admin Panel">
      <Text style={styles.text}>Show admin-only analytics and controls, guarded by user.isAdmin.</Text>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text }
});

export default AdminPanelScreen;
