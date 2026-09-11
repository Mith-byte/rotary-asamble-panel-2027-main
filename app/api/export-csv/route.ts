import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dutyLabelWithTerm } from "@/lib/duties";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify admin role
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all users with package names
  const { data: users, error } = await admin
    .from("profiles")
    .select("first_name, last_name, email, phone, club, gorev, gender, status, pricing_type, packages!package_id(name)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort: accepted first, then by first_name + last_name
  const sorted = (users ?? []).sort((a, b) => {
    if (a.status === "accepted" && b.status !== "accepted") return -1;
    if (a.status !== "accepted" && b.status === "accepted") return 1;
    const nameA = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
    const nameB = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
    return nameA.localeCompare(nameB, "tr");
  });

  // Build CSV
  const headers = ["Ad", "Soyad", "E-posta", "Telefon", "Kulüp", "Görev", "Cinsiyet", "Paket", "Kayıt Dönemi", "Durum"];

  const escapeField = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const pricingLabels: Record<string, string> = {
    early_bird: "Erken Kayıt",
    round_1: "1. Dalga",
    round_2: "2. Dalga",
  };

  const rows = sorted.map((u) => {
    const pkg = u.packages as unknown as { name: string } | null;
    return [
      u.first_name ?? "",
      u.last_name ?? "",
      u.email ?? "",
      u.phone ? `+${u.phone}` : "",
      u.club ?? "",
      dutyLabelWithTerm(u.gorev) ?? "",
      u.gender ?? "",
      pkg?.name ?? "",
      pricingLabels[u.pricing_type as string] ?? (u.pricing_type ?? ""),
      u.status === "accepted" ? "Onaylı" : "Beklemede",
    ].map(escapeField).join(",");
  });

  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kullanicilar-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
