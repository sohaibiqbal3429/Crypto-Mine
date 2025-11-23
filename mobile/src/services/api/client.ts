import axios from 'axios';
import { API_BASE_URL } from '../../config/env';
import { TokenStorage } from '../storage/tokenStorage';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

client.interceptors.request.use(async (config) => {
  const { token } = await TokenStorage.load();
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await TokenStorage.clear();
    }
    return Promise.reject(error);
  }
);

export default client;
