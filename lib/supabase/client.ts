import { createBrowserClient } from "@supabase/ssr";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isProduction = hostname.endsWith("asamble2440.com");

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    isProduction
      ? { cookieOptions: { domain: ".asamble2440.com" } }
      : {}
  );
}
