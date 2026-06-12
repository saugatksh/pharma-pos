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
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 10000 });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        // If refresh fails due to suspension/expiry, store the reason
        const refreshCode = refreshError.response?.data?.code;
        const refreshMsg = refreshError.response?.data?.message;
        localStorage.clear();
        if (refreshCode === 'PHARMACY_SUSPENDED' || refreshCode === 'SUBSCRIPTION_EXPIRED') {
          sessionStorage.setItem('authError', refreshMsg);
        }
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;