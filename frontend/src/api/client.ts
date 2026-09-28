import axios from 'axios';

/** URL ของ backend: Vercel อ่านจาก Environment Variable ส่วน local ใช้ Vite proxy */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const BACKEND_ORIGIN = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : '';

/** เปลี่ยน path ไฟล์จาก backend ให้เป็น URL เต็มเมื่อ frontend และ backend อยู่คนละโดเมน */
export const resolveBackendUrl = (value?: string): string => {
  if (!value || /^https?:\/\//i.test(value)) return value || '';
  return `${BACKEND_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('print_exam_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('print_exam_token');
      localStorage.removeItem('print_exam_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
