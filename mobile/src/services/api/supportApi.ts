import client from './client';

export const fetchTickets = async () => {
  const { data } = await client.get('/support/tickets');
  return data;
};

export const createTicket = async (subject: string, message: string) => {
  const { data } = await client.post('/support/tickets', { subject, message });
  return data;
};
