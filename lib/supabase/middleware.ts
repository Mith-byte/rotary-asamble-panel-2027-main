import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          const hostname = request.nextUrl.hostname;
          const rootDomain = hostname.split(".").slice(-2).join(".");
          const isLocalhost = hostname === "localhost" || hostname.startsWith("127.0.0.1") || hostname.endsWith(".local");
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(!isLocalhost && { domain: `.${rootDomain}` }),
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileComplete = true;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, role")
      .eq("id", user.id)
      .single();
    profileComplete = !!(profile?.role === "admin" || profile?.first_name);
  }

  return { user, profileComplete, supabaseResponse };
}
