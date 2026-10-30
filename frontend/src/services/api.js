import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_recruit_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear outdated or mismatched role tokens
      if (error.response.data?.detail?.includes("Candidate portal permission required") ||
          error.response.data?.detail?.includes("HR Recruiter portal permission required")) {
        localStorage.removeItem('smart_recruit_token');
        localStorage.removeItem('smart_recruit_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

