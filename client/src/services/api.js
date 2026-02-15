import axios from 'axios';

function buildApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
  if (!raw) return 'http://localhost:5000/api';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
}

const api = axios.create({
  baseURL: buildApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const messageFromJson = error?.response?.data?.message;
    const messageFromText = typeof error?.response?.data === 'string' ? error.response.data : '';
    if (!error.message && (messageFromJson || messageFromText)) {
      error.message = messageFromJson || messageFromText;
    }
    return Promise.reject(error);
  }
);

export default api;
