import client from './client';
import { TaskClaimResponse, TasksResponse } from '../../../../types/api-contracts';

export const fetchTasks = async () => {
  const { data } = await client.get<TasksResponse>('/tasks');
  return data;
};

export const completeTask = async (taskId: string) => {
  const { data } = await client.post<TaskClaimResponse>(`/tasks/claim`, { taskId });
  return data;
};
