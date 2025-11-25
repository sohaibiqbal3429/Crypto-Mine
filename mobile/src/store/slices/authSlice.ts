import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as authApi from '../../services/api/authApi';
import { TokenStorage } from '../../services/storage/tokenStorage';

export interface User {
  id: string;
  email: string;
  isAdmin?: boolean;
}

interface AuthState {
  user?: User;
  token?: string;
  isAuthenticated: boolean;
  loading: boolean;
  error?: string;
}

const initialState: AuthState = {
  isAuthenticated: false,
  loading: false
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }) => {
    const response = await authApi.login(payload.email, payload.password);
    return response;
  }
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  await authApi.logout();
  await TokenStorage.clear();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrate: (state, action: PayloadAction<AuthState>) => ({ ...state, ...action.payload }),
    logout: () => initialState
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Login failed';
      })
      .addCase(logoutThunk.fulfilled, () => initialState);
  }
});

export const { logout, hydrate } = authSlice.actions;
export default authSlice.reducer;
