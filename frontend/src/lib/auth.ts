
export const TOKEN_KEY =
  "pharmapilot_access_token";

export const PHARMACY_KEY =
  "pharmapilot_pharmacy_id";

export function saveSession(
  accessToken: string,
  pharmacyId: string
): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(PHARMACY_KEY, pharmacyId);
}

export function isAuthenticated(): boolean {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PHARMACY_KEY);
}
