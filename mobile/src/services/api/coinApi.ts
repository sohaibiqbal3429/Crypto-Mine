import client from './client';

export const fetchCoins = async () => {
  const { data } = await client.get('/coins');
  return data;
};
