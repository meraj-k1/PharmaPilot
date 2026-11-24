
import axios from "axios";

export const AUTH_TOKEN_KEY = "pharmapilot_access_token";
export const PHARMACY_ID_KEY = "pharmapilot_pharmacy_id";

export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getAccessToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getSelectedPharmacyId(): string | null {
  return sessionStorage.getItem(PHARMACY_ID_KEY);
}

export function setSelectedPharmacyId(
  pharmacyId: string
): void {
  sessionStorage.setItem(PHARMACY_ID_KEY, pharmacyId);
}

export function clearSelectedPharmacy(): void {
  sessionStorage.removeItem(PHARMACY_ID_KEY);
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(PHARMACY_ID_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const pharmacyId = getSelectedPharmacyId();

  if (token) {
    config.headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  if (pharmacyId) {
    config.headers.set(
      "X-Pharmacy-ID",
      pharmacyId
    );
  } else {
    config.headers.delete("X-Pharmacy-ID");
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest =
      error.config?.url?.includes("/auth/login") ??
      false;

    if (
      error.response?.status === 401 &&
      !isLoginRequest
    ) {
      clearAuthSession();

      window.dispatchEvent(
        new Event("pharmapilot:unauthorized")
      );
    }

    return Promise.reject(error);
  }
);
