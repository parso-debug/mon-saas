import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

/** Resolve image URL: passes through data: and absolute URLs, prepends backend for /api/* paths. */
export const resolveImg = (url) => {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/api/")) return `${BACKEND_URL}${url}`;
  return url;
};

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aw_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
