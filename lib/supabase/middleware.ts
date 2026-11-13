import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";

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
          const isProduction = hostname.endsWith("asamble2440.com");
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(isProduction && { domain: ".asamble2440.com" }),
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
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin" || isAdminEmail(user.email);
    userRole = isAdmin ? "admin" : profile?.role || "user";
    profileComplete = !!(isAdmin || profile?.first_name);
  }

  return { user, profileComplete, role: userRole, supabaseResponse };
}
