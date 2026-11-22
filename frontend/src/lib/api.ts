
import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(
    "pharmapilot_access_token"
  );

  const pharmacyId = sessionStorage.getItem(
    "pharmapilot_pharmacy_id"
  );

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (pharmacyId) {
    config.headers["X-Pharmacy-ID"] = pharmacyId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    ) {
      sessionStorage.removeItem(
        "pharmapilot_access_token"
      );

      window.dispatchEvent(
        new Event("pharmapilot:unauthorized")
      );
    }

    return Promise.reject(error);
  }
);
