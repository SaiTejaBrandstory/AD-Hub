import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

if (!BACKEND_URL && process.env.NODE_ENV === "production") {
  console.error(
    "[AdHub] REACT_APP_BACKEND_URL is missing. Set it in Vercel → Settings → Environment Variables, then redeploy."
  );
}

export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adhub_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setToken = (t) => {
  if (t) localStorage.setItem("adhub_token", t);
  else localStorage.removeItem("adhub_token");
};
