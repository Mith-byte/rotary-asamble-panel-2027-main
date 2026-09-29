import { createBrowserClient } from "@supabase/ssr";

const rootDomain = typeof window !== "undefined"
  ? window.location.hostname.split(".").slice(-2).join(".")
  : "";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    rootDomain && rootDomain !== "localhost"
      ? { cookieOptions: { domain: `.${rootDomain}` } }
      : {}
  );
}
