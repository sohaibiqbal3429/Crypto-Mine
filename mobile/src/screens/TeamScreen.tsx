import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as teamApi from '../services/api/teamApi';
import { useToast } from '../components/ToastProvider';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  level?: number;
}

interface TeamStats {
  total: number;
  active: number;
  rewards: number;
}

const TeamScreen = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | undefined>();
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = async () => {
    try {
      const [teamRes, statsRes] = await Promise.all([teamApi.fetchTeam(), teamApi.fetchStats()]);
      setMembers(teamRes?.members ?? teamRes ?? []);
      setStats(statsRes?.stats ?? statsRes);
    } catch (error: any) {
      show(error?.message ?? 'Unable to load team', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      {stats && (
        <Card title="Team Overview" style={{ marginBottom: spacing.md }}>
          <Text style={styles.text}>Total: {stats.total}</Text>
          <Text style={styles.text}>Active: {stats.active}</Text>
          <Text style={styles.text}>Rewards Earned: ${stats.rewards}</Text>
        </Card>
      )}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <Card title={item.name}>
              <Text style={styles.text}>{item.email}</Text>
              {item.level !== undefined && <Text style={styles.subText}>Level {item.level}</Text>}
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.text}>No team members yet.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body },
  subText: { color: colors.textMuted, marginTop: spacing.xs }
});

export default TeamScreen;
