import { useEffect } from 'react';
import { useAppDispatch } from '../store/hooks';
import { hydrate } from '../store/slices/authSlice';
import { TokenStorage } from '../services/storage/tokenStorage';

export const useHydrateAuth = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const load = async () => {
      const saved = await TokenStorage.load();
      if (saved.token) {
        dispatch(
          hydrate({
            token: saved.token,
            user: saved.user,
            isAuthenticated: true,
            loading: false
          })
        );
      }
    };
    load();
  }, [dispatch]);
};
