import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as miningApi from '../../services/api/miningApi';

export interface MiningState {
  status: 'idle' | 'mining' | 'cooldown';
  nextWindow?: string;
  loading: boolean;
  error?: string;
}

const initialState: MiningState = {
  status: 'idle',
  loading: false
};

export const fetchMiningStatus = createAsyncThunk('mining/status', async () => {
  const status = await miningApi.fetchStatus();
  return status;
});

export const startMining = createAsyncThunk('mining/start', async () => {
  const status = await miningApi.startMining();
  return status;
});

const miningSlice = createSlice({
  name: 'mining',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMiningStatus.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(fetchMiningStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        state.nextWindow = action.payload.nextWindow;
      })
      .addCase(fetchMiningStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(startMining.pending, (state) => {
        state.loading = true;
      })
      .addCase(startMining.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        state.nextWindow = action.payload.nextWindow;
      })
      .addCase(startMining.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default miningSlice.reducer;
