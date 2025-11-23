import axios from 'axios';

import { API_BASE_URL } from '../../config/env';
import { TokenStorage } from '../storage/tokenStorage';

const baseURL = API_BASE_URL.replace(/\/$/, '');

const client = axios.create({
  baseURL,
  timeout: 12000,
});

client.interceptors.request.use(async (config) => {
  const { token } = await TokenStorage.load();
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  config.headers = {
    Accept: 'application/json',
    ...config.headers,
  };

  if (__DEV__) {
    console.log(`[api] ${config.method?.toUpperCase()} ${config.url}`);
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await TokenStorage.clear();
    }

    if (__DEV__) {
      console.error('[api] error', error.response?.status, error.response?.data || error.message);
    }

    return Promise.reject(error);
  },
);

export default client;
