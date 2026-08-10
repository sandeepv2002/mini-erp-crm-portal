import axios from 'axios';

// Default to live Render production backend if not explicitly set
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://mini-erp-crm-portal-za5a.onrender.com'
).replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to attach JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
