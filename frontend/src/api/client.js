// frontend/src/api/client.js
import axios from "axios";

const client = axios.create({
baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach JWT to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("mt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — clear auth and reload
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("mt_token");
      localStorage.removeItem("mt_user");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default client;
