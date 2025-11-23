import client from './client';

export const fetchTeam = async () => {
  const { data } = await client.get('/team');
  return data;
};

export const fetchStats = async () => {
  const { data } = await client.get('/team/stats');
  return data;
};
