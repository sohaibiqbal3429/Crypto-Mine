import { Middleware } from '@reduxjs/toolkit';
import { hydrate, logout } from '../slices/authSlice';
import { TokenStorage } from '../../services/storage/tokenStorage';

export const tokenPersistMiddleware: Middleware = (storeApi) => (next) => async (action) => {
  const result = next(action);

  if (hydrate.match(action)) {
    return result;
  }

  if (logout.match(action)) {
    await TokenStorage.clear();
    return result;
  }

  const state = storeApi.getState() as any;
  if (state.auth?.token) {
    await TokenStorage.save({ token: state.auth.token, user: state.auth.user });
  }

  return result;
};
