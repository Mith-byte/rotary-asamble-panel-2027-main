import { createBrowserClient } from "@supabase/ssr";

const isProduction =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("konferanszamancarklari.com");

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    isProduction
      ? { cookieOptions: { domain: ".konferanszamancarklari.com" } }
      : {}
  );
}
