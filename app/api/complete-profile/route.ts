import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { DUTY_IDS, getDuty } from "@/lib/duties";
import { isClubForDutyGroup } from "@/lib/clubs";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const body = await request.json();
  const { firstName, lastName, phone, club, gorev, gender, packageId } = body;

  if (!firstName || !lastName || !phone || !club || !gender || !packageId) {
    return NextResponse.json({ error: "Tüm alanlar gerekli" }, { status: 400 });
  }

  const duty = typeof gorev === "string" && DUTY_IDS.includes(gorev) ? gorev : null;

  if (!isClubForDutyGroup(club, getDuty(duty)?.group ?? null)) {
    return NextResponse.json(
      { error: "Seçtiğiniz kulüp bu görevle uyuşmuyor. Kulübünüzü yeniden seçin." },
      { status: 400 },
    );
  }

  const { data: activePeriod, error: periodError } = await supabase
    .from("pricing_periods")
    .select("id")
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString())
    .single();

  if (periodError || !activePeriod) {
    console.error("[complete-profile] No active pricing period:", periodError);
    return NextResponse.json({ error: "Kayıtlar kapanmıştır" }, { status: 400 });
  }

  const pricingType = activePeriod.id;

  const profileUpdate: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    phone,
    club,
    gender,
    package_id: packageId,
    pricing_type: pricingType,
  };
  if (duty) profileUpdate.gorev = duty;

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (updateError) {
    console.error("[complete-profile] Profile update failed:", updateError);
    return NextResponse.json({ error: "Profil güncellenemedi: " + updateError.message }, { status: 500 });
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("capacity")
    .eq("id", packageId)
    .single();

  if (pkgError) {
    console.error("[complete-profile] Package fetch failed:", pkgError);
    return NextResponse.json({ error: "Paket bilgisi alınamadı: " + pkgError.message }, { status: 500 });
  }

  if (pkg) {
    if (pkg.capacity && pkg.capacity > 1) {
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({ capacity: pkg.capacity, created_by: user.id })
        .select("id")
        .single();

      if (roomError) {
        console.error("[complete-profile] Room creation failed:", roomError);
      } else if (room) {
        const { error: roomAssignError } = await supabase
          .from("profiles")
          .update({ room_id: room.id })
          .eq("id", user.id);

        if (roomAssignError) {
          console.error("[complete-profile] Room assignment failed:", roomAssignError);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
