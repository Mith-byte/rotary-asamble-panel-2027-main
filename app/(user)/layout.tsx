import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { signOut } from "@/lib/actions/auth";
import { event } from "@/lib/event";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, gorev, status")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar profile={profile} signOutAction={signOut} />
      <main className="flex-1 px-5 pb-24 pt-7 md:px-8 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-4xl">{children}</div>
        <footer className="mx-auto mt-12 max-w-4xl border-t border-rule pt-4">
          <p className="t-note text-muted-foreground">
            {event.district} · {event.dateLabel} · {event.venue}
          </p>
        </footer>
      </main>
    </div>
  );
}
