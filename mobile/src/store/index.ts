import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import walletReducer from './slices/walletSlice';
import miningReducer from './slices/miningSlice';
import { tokenPersistMiddleware } from './middleware/tokenPersistMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    mining: miningReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(tokenPersistMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
