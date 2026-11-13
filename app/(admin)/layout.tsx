import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/lib/actions/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { event } from "@/lib/event";
import { isAdminEmail } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris");
  }

  const admin = createAdminClient();
  const isAdmin = isAdminEmail(user.email);

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && !isAdmin) {
    redirect("/");
  }

  if (isAdmin && profile?.role !== "admin") {
    await admin
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        role: "admin",
        first_name: profile?.first_name || "Admin",
        last_name: profile?.last_name || "Yöneticisi",
        status: "accepted",
      });
  }

  const effectiveProfile = {
    first_name: profile?.first_name || (isAdmin ? "Admin" : null),
    last_name: profile?.last_name || (isAdmin ? "Yöneticisi" : null),
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar profile={effectiveProfile} signOutAction={signOut} />
      <main className="flex-1 px-5 pb-24 pt-7 md:px-8 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
        <footer className="mx-auto mt-12 max-w-5xl border-t border-rule pt-4">
          <p className="t-note text-muted-foreground">
            {event.district} · {event.name} · {event.term} dönemi
          </p>
        </footer>
      </main>
    </div>
  );
}
