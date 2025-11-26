import * as SecureStore from 'expo-secure-store';

interface TokenPayload {
  token?: string;
  user?: any;
}

const TOKEN_KEY = 'mintminepro_token';
const USER_KEY = 'mintminepro_user';

export const TokenStorage = {
  save: async ({ token, user }: TokenPayload) => {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  load: async (): Promise<TokenPayload> => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userRaw = await SecureStore.getItemAsync(USER_KEY);
    return { token: token ?? undefined, user: userRaw ? JSON.parse(userRaw) : undefined };
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }
};
