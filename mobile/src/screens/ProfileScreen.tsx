import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as profileApi from '../services/api/profileApi';
import { useToast } from '../components/ToastProvider';

interface Profile {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

const ProfileScreen = () => {
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await profileApi.fetchProfile();
        setProfile(response?.profile ?? response);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load profile', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [show]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : profile ? (
        <Card title="Profile">
          {profile.name && <Text style={styles.text}>Name: {profile.name}</Text>}
          <Text style={styles.text}>Email: {profile.email}</Text>
          {profile.role && <Text style={styles.text}>Role: {profile.role}</Text>}
        </Card>
      ) : (
        <Text style={styles.text}>No profile found.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body, marginBottom: spacing.xs }
});

export default ProfileScreen;
