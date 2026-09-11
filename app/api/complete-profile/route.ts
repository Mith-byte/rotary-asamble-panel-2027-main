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
  const { firstName, lastName, phone, club, gorev, gender, packageId, dekontPath } = body;

  if (!firstName || !lastName || !phone || !club || !gender || !packageId) {
    return NextResponse.json({ error: "Tüm alanlar gerekli" }, { status: 400 });
  }

  // Görev is accepted but not yet required: the registration form has no duty
  // picker, so demanding one here would close registration outright. Make it
  // required as soon as the picker lands. An id that is not one of the 26 is a
  // stale or hand-edited link, so it is dropped rather than rejected — the
  // registrant did not type it.
  const duty = typeof gorev === "string" && DUTY_IDS.includes(gorev) ? gorev : null;

  /* The client filters the club roster by görev, so a mismatched pairing can
     only arrive from a hand-made request or a stale form. Reject it: a
     Rotaract club under a district görev would land in the public roster and
     misdescribe the registrant. */
  if (!isClubForDutyGroup(club, getDuty(duty)?.group ?? null)) {
    return NextResponse.json(
      { error: "Seçtiğiniz kulüp bu görevle uyuşmuyor. Kulübünüzü yeniden seçin." },
      { status: 400 },
    );
  }

  // Determine pricing type based on current active period (server-side, not client-provided)
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

  // Update profile
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
  if (dekontPath) profileUpdate.dekont_url = dekontPath;

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (updateError) {
    console.error("[complete-profile] Profile update failed:", updateError);
    return NextResponse.json({ error: "Profil güncellenemedi: " + updateError.message }, { status: 500 });
  }

  // Fetch the package to get installment amount and capacity
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("capacity, early_bird_installment_price, round_1_installment_price, round_2_installment_price")
    .eq("id", packageId)
    .single();

  if (pkgError) {
    console.error("[complete-profile] Package fetch failed:", pkgError);
    return NextResponse.json({ error: "Paket bilgisi alınamadı: " + pkgError.message }, { status: 500 });
  }

  if (pkg) {
    /*
      Everything below is derived from the registration, not the registration
      itself — the profile row above IS the registration. So each side effect is
      attempted independently and a failure is logged rather than returned:
      answering "kayıt başarısız" to someone who is, in fact, registered leaves
      them staring at an error with no way to tell what happened.

      The room is created FIRST. It used to run after the instalment insert,
      which meant a failing instalment (a null amount, before prices existed)
      returned early and cost the registrant their room as well.
    */
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

    const amount = pkg[
      `${pricingType}_installment_price` as keyof typeof pkg
    ] as number | null;

    /*
      No price issued means there is no instalment to record. `amount` is NOT
      NULL in the database, so this used to fail the request outright.
      Registrations made before pricing simply carry no instalment row.
    */
    if (amount != null) {
      const { error: installmentError } = await supabase.from("installments").insert({
        user_id: user.id,
        installment_number: 1,
        amount,
        ...(dekontPath && { dekont_url: dekontPath }),
        status: "pending",
      });

      if (installmentError) {
        console.error("[complete-profile] Installment insert failed:", installmentError);
      }
    }
  }

  return NextResponse.json({ success: true });
}
