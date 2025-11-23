import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as teamApi from '../services/api/teamApi';
import { useToast } from '../components/ToastProvider';

interface TeamMember {
  id: string;
  name?: string;
  level?: number;
  qualified?: boolean;
  createdAt?: string;
}

interface TeamStats {
  available: number;
  claimedTotal: number;
  pendingCount: number;
}

const TeamScreen = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | undefined>();
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = async () => {
    try {
      const [teamRes, statsRes] = await Promise.all([teamApi.fetchTeam(), teamApi.fetchStats()]);
      setMembers(
        teamRes?.items?.map((member) => ({
          id: member._id,
          name: member.name || 'Member',
          level: member.level,
          qualified: member.qualified,
          createdAt: member.createdAt,
        })) ?? [],
      );
      setStats({
        available: statsRes.available,
        claimedTotal: statsRes.claimedTotal,
        pendingCount: statsRes.pending?.length ?? 0,
      });
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
        <Card title="Team Rewards" style={{ marginBottom: spacing.md }}>
          <Text style={styles.text}>Available: ${stats.available.toFixed(2)}</Text>
          <Text style={styles.text}>Claimed: ${stats.claimedTotal.toFixed(2)}</Text>
          <Text style={styles.text}>Pending payouts: {stats.pendingCount}</Text>
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
              {item.level !== undefined && <Text style={styles.subText}>Level {item.level}</Text>}
              {item.qualified !== undefined && (
                <Text style={styles.subText}>{item.qualified ? 'Qualified' : 'Unqualified'}</Text>
              )}
              {item.createdAt && <Text style={styles.subText}>Joined {new Date(item.createdAt).toLocaleDateString()}</Text>}
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
