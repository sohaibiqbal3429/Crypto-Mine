import client from './client';

export const fetchStatus = async () => {
  const { data } = await client.get('/mining/status');
  return data;
};

export const startMining = async () => {
  const { data } = await client.post('/mining/start');
  return data;
};
