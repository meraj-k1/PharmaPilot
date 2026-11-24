
export const TOKEN_KEY = "pharmapilot_access_token";

export const PHARMACY_KEY = "pharmapilot_pharmacy_id";

export function saveSession(
  accessToken: string,
  pharmacyId?: string
): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken);

  if (pharmacyId) {
    sessionStorage.setItem(PHARMACY_KEY, pharmacyId);
  } else {
    sessionStorage.removeItem(PHARMACY_KEY);
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getSelectedPharmacyId(): string | null {
  return sessionStorage.getItem(PHARMACY_KEY);
}

export function setSelectedPharmacyId(
  pharmacyId: string
): void {
  sessionStorage.setItem(PHARMACY_KEY, pharmacyId);
}

export function clearSelectedPharmacy(): void {
  sessionStorage.removeItem(PHARMACY_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PHARMACY_KEY);
}
