export const ADMIN_EMAILS: readonly string[] = [
  "twinvision.verdapulse@gmail.com",
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
