export const ALLOWED_ADMIN_EMAIL = "info@artemisrental.gr";

export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  return (email ?? "").trim().toLowerCase() === ALLOWED_ADMIN_EMAIL;
}
