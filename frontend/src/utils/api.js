import axios from 'axios';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  const hostname = window.location.hostname;
  return `http://${hostname}:5000/api`;
};
const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh + network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Surface network/timeout errors clearly
    if (!error.response) {
      const networkError = new Error(
        error.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your connection and try again.'
          : 'Cannot connect to server. Please make sure the backend is running.'
      );
      networkError.response = { data: { message: networkError.message } };
      return Promise.reject(networkError);
    }

    // Handle pharmacy suspended / subscription expired — redirect with message
    const code = error.response?.data?.code;
    if (code === 'PHARMACY_SUSPENDED' || code === 'SUBSCRIPTION_EXPIRED') {
      const msg = error.response?.data?.message;
      localStorage.clear();
      sessionStorage.setItem('authError', msg);
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Token expired — try refresh
    if (error.response?.status === 401 && !original._retry) {
      const code = error.response?.data?.code;
      original._retry = true;

      if (code === 'TOKEN_EXPIRED') {
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 10000 });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch (refreshError) {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No token / invalid token / user not found — just send to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;