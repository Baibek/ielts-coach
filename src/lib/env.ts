// Public Supabase settings (safe in the browser; data is protected by RLS).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The only email allowed to use the app. Empty = anyone (not recommended). */
export function allowedEmail(): string {
  return (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = allowedEmail();
  if (!allowed) return true;
  return (email ?? "").trim().toLowerCase() === allowed;
}
