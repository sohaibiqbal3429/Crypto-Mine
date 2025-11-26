import client from './client';

export const fetchSummary = async () => {
  const { data } = await client.get('/admin/summary');
  return data;
};
