import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as taskApi from '../services/api/taskApi';
import { useToast } from '../components/ToastProvider';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
}

const TaskScreen = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = async () => {
    try {
      const response = await taskApi.fetchTasks();
      setTasks(response?.tasks ?? response ?? []);
    } catch (error: any) {
      show(error?.message ?? 'Unable to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (taskId: string) => {
    try {
      await taskApi.completeTask(taskId);
      show('Task completed', 'success');
      load();
    } catch (error: any) {
      show(error?.message ?? 'Unable to complete task', 'error');
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <Card title={item.title}>
              {item.description && <Text style={styles.text}>{item.description}</Text>}
              <View style={{ marginTop: spacing.sm }}>
                <Button title={item.completed ? 'Completed' : 'Mark complete'} onPress={() => complete(item.id)} disabled={item.completed} />
              </View>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.text}>No tasks available.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body }
});

export default TaskScreen;
