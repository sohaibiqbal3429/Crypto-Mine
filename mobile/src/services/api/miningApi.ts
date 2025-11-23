import client from './client';
import { MiningStartResponse, MiningStatusResponse } from '../../../../types/api-contracts';

export const fetchStatus = async () => {
  const { data } = await client.get<MiningStatusResponse>('/mining/status');
  return data;
};

export const startMining = async () => {
  const { data } = await client.post<MiningStartResponse>('/mining/start-session');
  return data;
};
