import client from './client';

export const fetchFaqs = async () => {
  const { data } = await client.get('/faqs');
  return data;
};
