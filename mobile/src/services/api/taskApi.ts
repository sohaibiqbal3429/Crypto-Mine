import client from './client';

export const fetchTasks = async () => {
  const { data } = await client.get('/tasks');
  return data;
};

export const completeTask = async (taskId: string) => {
  const { data } = await client.post(`/tasks/${taskId}/complete`);
  return data;
};
