import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { DUTY_IDS, getDuty } from "@/lib/duties";
import { isClubForDutyGroup } from "@/lib/clubs";
import { calculateReservationPrice, calculateChildAge } from "@/lib/pricing";

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
  const {
    firstName,
    lastName,
    phone,
    club,
    gorev,
    gender,
    packageId,
    hasRoommate = false,
    roommate = null,
    adult2 = null,
    children = [],
  } = body;

  if (!firstName || !lastName || !phone || !club || !gender || !packageId) {
    return NextResponse.json({ error: "Tüm zorunlu alanlar doldurulmalıdır" }, { status: 400 });
  }

  const duty = typeof gorev === "string" && DUTY_IDS.includes(gorev) ? gorev : null;

  if (!isClubForDutyGroup(club, getDuty(duty)?.group ?? null)) {
    return NextResponse.json(
      { error: "Seçtiğiniz kulüp bu görevle uyuşmuyor. Kulübünüzü yeniden seçin." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Aktif fiyatlandırma dönemini al
  const { data: activePeriod, error: periodError } = await admin
    .from("pricing_periods")
    .select("id")
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString())
    .single();

  if (periodError || !activePeriod) {
    console.error("[complete-profile] No active pricing period:", periodError);
    return NextResponse.json({ error: "Kayıtlar kapanmıştır" }, { status: 400 });
  }

  const pricingType = activePeriod.id as "early_bird" | "round_1" | "round_2";

  // Paket bilgilerini çek
  const { data: pkg, error: pkgError } = await admin
    .from("packages")
    .select("id, name, capacity, early_bird_price, round_1_price, round_2_price, nights")
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) {
    console.error("[complete-profile] Package fetch failed:", pkgError);
    return NextResponse.json({ error: "Paket bilgisi alınamadı" }, { status: 500 });
  }

  const capacity = pkg.capacity ?? 1;
  const adultPrice = (pkg[`${pricingType}_price` as const] as number) ?? 0;

  // 1. ODA TİPİNE GÖRE DOĞRULAMA (Validation)
  // 2 Kişilik Oda: Oda arkadaşı var seçildiyse ad ve soyad zorunlu
  if (capacity === 2 && hasRoommate) {
    if (!roommate?.firstName?.trim() || !roommate?.lastName?.trim()) {
      return NextResponse.json(
        { error: "2. kişi (oda arkadaşı) için ad ve soyad zorunludur." },
        { status: 400 }
      );
    }
  }

  // 3 Kişilik Oda (Aile Odası): 2. Yetişkin zorunlu, çocukların bilgileri eksiksiz olmalı
  if (capacity === 3) {
    if (!adult2?.firstName?.trim() || !adult2?.lastName?.trim()) {
      return NextResponse.json(
        { error: "Aile odasında 2. yetişkin bilgileri zorunludur." },
        { status: 400 }
      );
    }

    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (!c.firstName?.trim() || !c.lastName?.trim() || !c.birthDate) {
          return NextResponse.json(
            { error: `${i + 1}. çocuk için ad, soyad ve doğum tarihi zorunludur.` },
            { status: 400 }
          );
        }
      }
    }
  }

  // 2. FİYAT VE ODA HESAPLAMA (Server-side Güvenli Hesaplama)
  const calculation = calculateReservationPrice({
    adultPrice,
    capacity,
    hasRoommate: !!hasRoommate,
    children: capacity === 3 && Array.isArray(children) ? children : [],
  });

  const totalAmount = calculation.totalAmount;
  const remainingCapacity = calculation.remainingCapacity;

  // 3. ODA OLUŞTURMA / GÜNCELLEME
  let roomId: string | null = null;

  if (capacity > 1) {
    // Kullanıcının mevcut odası var mı kontrol et
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("room_id")
      .eq("id", user.id)
      .single();

    if (currentProfile?.room_id) {
      roomId = currentProfile.room_id;
      // Mevcut odayı güncelle
      await admin
        .from("rooms")
        .update({
          capacity: capacity === 3 ? Math.max(3, 2 + children.length) : capacity,
          remaining_capacity: remainingCapacity,
          room_type: capacity === 3 ? "family" : "double",
        })
        .eq("id", roomId);

      // Eski misafirleri temizle (yeniden ekleyeceğiz)
      await admin.from("room_guests").delete().eq("room_id", roomId);
    } else {
      // Yeni oda oluştur
      const { data: newRoom, error: roomError } = await admin
        .from("rooms")
        .insert({
          capacity: capacity === 3 ? Math.max(3, 2 + children.length) : capacity,
          remaining_capacity: remainingCapacity,
          room_type: capacity === 3 ? "family" : "double",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (roomError) {
        console.error("[complete-profile] Room creation failed:", roomError);
      } else if (newRoom) {
        roomId = newRoom.id;
      }
    }

    // 4. MİSAFİRLERİ (room_guests) KAYDET
    if (roomId) {
      const guestsToInsert: Array<{
        room_id: string;
        registered_by: string;
        guest_type: "adult" | "child";
        first_name: string;
        last_name: string;
        phone: string | null;
        gender: string;
        club: string | null;
        birth_date: string | null;
        age: number | null;
        price: number;
      }> = [];

      // 2 Kişilik odada oda arkadaşı
      if (capacity === 2 && hasRoommate && roommate) {
        guestsToInsert.push({
          room_id: roomId,
          registered_by: user.id,
          guest_type: "adult",
          first_name: roommate.firstName.trim(),
          last_name: roommate.lastName.trim(),
          phone: roommate.phone ? roommate.phone.trim() : null,
          gender: roommate.gender || "Erkek",
          club: roommate.club || club,
          birth_date: null,
          age: null,
          price: adultPrice,
        });
      }

      // Aile odasında 2. Yetişkin
      if (capacity === 3 && adult2) {
        guestsToInsert.push({
          room_id: roomId,
          registered_by: user.id,
          guest_type: "adult",
          first_name: adult2.firstName.trim(),
          last_name: adult2.lastName.trim(),
          phone: adult2.phone ? adult2.phone.trim() : null,
          gender: adult2.gender || "Kadın",
          club: adult2.club || club,
          birth_date: null,
          age: null,
          price: adultPrice,
        });

        // Aile odasında çocuklar
        if (Array.isArray(children)) {
          for (const child of children) {
            const childItem = calculation.items.find(
              (it) => it.label.includes(child.firstName) || it.label.includes("Çocuk")
            );
            const childAge = child.birthDate ? calculateChildAge(child.birthDate) : null;

            guestsToInsert.push({
              room_id: roomId,
              registered_by: user.id,
              guest_type: "child",
              first_name: child.firstName.trim(),
              last_name: child.lastName.trim(),
              phone: null,
              gender: child.gender || "Erkek",
              club: null,
              birth_date: child.birthDate,
              age: childAge,
              price: childItem?.total ?? 0,
            });
          }
        }
      }

      if (guestsToInsert.length > 0) {
        const { error: guestError } = await admin
          .from("room_guests")
          .insert(guestsToInsert);

        if (guestError) {
          console.error("[complete-profile] Room guests insertion failed:", guestError);
        }
      }
    }
  }

  // 5. PROFİLİ GÜNCELLE
  const profileUpdate: Record<string, unknown> = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    phone,
    club,
    gender,
    package_id: packageId,
    pricing_type: pricingType,
    total_amount: totalAmount,
    has_roommate: !!hasRoommate,
    guest_count: capacity === 2 && hasRoommate ? 1 : capacity === 3 ? 1 + children.length : 0,
  };

  if (roomId) {
    profileUpdate.room_id = roomId;
  }
  if (duty) {
    profileUpdate.gorev = duty;
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (updateError) {
    console.error("[complete-profile] Profile update failed:", updateError);
    return NextResponse.json(
      { error: "Profil güncellenemedi: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    totalAmount,
    remainingCapacity,
    roomId,
  });
}
