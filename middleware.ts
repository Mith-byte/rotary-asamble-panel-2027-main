import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/giris", "/kayit", "/kvkk"];
const PROFILE_COMPLETION_PATH = "/profil-tamamla";

export async function middleware(request: NextRequest) {
  const { user, profileComplete, supabaseResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }

  if (user && PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && !profileComplete && path !== PROFILE_COMPLETION_PATH && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = PROFILE_COMPLETION_PATH;
    return NextResponse.redirect(url);
  }

  if (user && profileComplete && path === PROFILE_COMPLETION_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
