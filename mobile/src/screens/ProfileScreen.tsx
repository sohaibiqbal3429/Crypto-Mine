import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing } from '../styles/theme';
import { useAppSelector } from '../store/hooks';

const ProfileScreen = () => {
  const user = useAppSelector((state) => state.auth.user);
  return (
    <View style={styles.container}>
      <Card title="Profile">
        <Text style={styles.text}>Email: {user?.email}</Text>
        <Text style={styles.text}>Role: {user?.isAdmin ? 'Admin' : 'User'}</Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, marginBottom: spacing.sm }
});

export default ProfileScreen;
