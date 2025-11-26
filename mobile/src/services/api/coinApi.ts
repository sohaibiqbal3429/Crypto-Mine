import client from './client';
import { CoinListResponse } from '../../../../types/api-contracts';

export const fetchCoins = async () => {
  const { data } = await client.get<CoinListResponse>('/coins');
  return data;
};
