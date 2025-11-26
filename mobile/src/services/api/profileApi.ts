import client from './client';

export const fetchProfile = async () => {
  const { data } = await client.get('/profile');
  return data;
};
