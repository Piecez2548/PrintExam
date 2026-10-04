import axios from 'axios';

/** URL ของ backend: Vercel อ่านจาก Environment Variable ส่วน local ใช้ Vite proxy */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const BACKEND_ORIGIN = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : '';

/** เปลี่ยน path ไฟล์จาก backend ให้เป็น URL เต็มเมื่อ frontend และ backend อยู่คนละโดเมน */
export const resolveBackendUrl = (value?: string): string => {
  if (!value || /^https?:\/\//i.test(value)) return value || '';
  return `${BACKEND_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

/** ดาวน์โหลด resource ผ่าน session cookie ที่ JavaScript อ่านไม่ได้ */
export const downloadAuthenticatedResource = async (value: string, filename: string): Promise<void> => {
  const response = await axios.get(resolveBackendUrl(value), {
    withCredentials: true,
    responseType: 'blob',
  });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
