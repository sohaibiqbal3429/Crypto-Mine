import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as walletApi from '../../services/api/walletApi';

export interface BalanceSummary {
  totalBalance: number;
  currentBalance: number;
  totalWithdraw: number;
  pendingWithdraw: number;
}

interface WalletState {
  summary: BalanceSummary;
  loading: boolean;
  error?: string;
}

const initialState: WalletState = {
  summary: {
    totalBalance: 0,
    currentBalance: 0,
    totalWithdraw: 0,
    pendingWithdraw: 0
  },
  loading: false
};

export const fetchWallet = createAsyncThunk('wallet/fetch', async () => {
  const response = await walletApi.fetchBalance();
  return {
    totalBalance: response.balance.totalBalance,
    currentBalance: response.balance.current,
    totalWithdraw: response.userStats.withdrawTotal ?? 0,
    pendingWithdraw: response.balance.pendingWithdraw,
  } satisfies BalanceSummary;
});

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default walletSlice.reducer;
