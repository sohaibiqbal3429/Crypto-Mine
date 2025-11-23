import client from './client';
import { BalanceSummary } from '../../store/slices/walletSlice';

export const fetchSummary = async (): Promise<BalanceSummary> => {
  const { data } = await client.get('/wallet/summary');
  return data;
};

export const withdraw = async (amount: number, address: string) => {
  const { data } = await client.post('/wallet/withdraw', { amount, address });
  return data;
};

export const depositMethods = async () => {
  const { data } = await client.get('/wallet/deposit-methods');
  return data;
};
