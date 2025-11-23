import client from './client';
import {
  DepositAddressResponse,
  WalletBalanceResponse,
  WithdrawHistoryResponse,
  WithdrawRequestPayload,
} from '../../../../types/api-contracts';

export const fetchBalance = async (): Promise<WalletBalanceResponse> => {
  const { data } = await client.get<WalletBalanceResponse>('/wallet/balance');
  return data;
};

export const withdraw = async (payload: WithdrawRequestPayload) => {
  const { data } = await client.post('/wallet/withdraw', payload);
  return data;
};

export const depositMethods = async (): Promise<DepositAddressResponse> => {
  const { data } = await client.get<DepositAddressResponse>('/wallet/deposit-address');
  return data;
};

export const fetchHistory = async (page = 1, limit = 50): Promise<WithdrawHistoryResponse> => {
  const { data } = await client.get<WithdrawHistoryResponse>(`/wallet/withdraw-history`, {
    params: { page, limit },
  });
  return data;
};
