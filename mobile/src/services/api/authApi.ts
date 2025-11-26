import client from './client';

export const login = async (email: string, password: string) => {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
};

export const register = async (email: string, password: string) => {
  const { data } = await client.post('/auth/register', { email, password });
  return data;
};

export const logout = async () => client.post('/auth/logout');
