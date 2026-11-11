import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { DUTY_IDS, getDuty } from "@/lib/duties";
import { isClubForDutyGroup } from "@/lib/clubs";
import { calculateReservationPrice, calculateChildAge, isFamilyPackage } from "@/lib/pricing";

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
    tcKimlik,
    birthDate,
    phone,
    club,
    gorev,
    gender,
    donorTypes = [],
    packageId,
    registrationType = "individual",
    roommatePreference1 = null,
    roommatePreference2 = null,
    hasRoommate: clientHasRoommate = false,
    roommate = null,
    roommate2 = null,
    adult2 = null,
    children = [],
  } = body;

  if (!firstName || !lastName || !phone || !club || !gender || !packageId || !tcKimlik || !birthDate) {
    return NextResponse.json({ error: "Tüm zorunlu alanlar doldurulmalıdır" }, { status: 400 });
  }

  const tcRegex = /^[1-9][0-9]{10}$/;
  if (!tcRegex.test(String(tcKimlik).trim())) {
    return NextResponse.json(
      { error: "Ana katılımcı için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz." },
      { status: 400 }
    );
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

  const isFamily = isFamilyPackage(pkg);
  const capacity = pkg.capacity ?? 1;
  const adultPrice = (pkg[`${pricingType}_price` as const] as number) ?? 0;

  // 1. ODA TİPİNE GÖRE DOĞRULAMA (Validation)
  if (isFamily) {
    // Aile Odası: 2. Yetişkin zorunlu, en az 1 çocuk zorunlu
    if (
      !adult2?.firstName?.trim() ||
      !adult2?.lastName?.trim() ||
      !adult2?.tcKimlik?.trim() ||
      !adult2?.birthDate ||
      !adult2?.email?.trim() ||
      !adult2?.phone?.trim()
    ) {
      return NextResponse.json(
        { error: "Aile odasında 2. Yetişkin için Ad, Soyad, TC Kimlik No, Doğum Tarihi, E-posta ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    if (!tcRegex.test(String(adult2.tcKimlik).trim())) {
      return NextResponse.json(
        { error: "2. Yetişkin için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz." },
        { status: 400 }
      );
    }

    if (!Array.isArray(children) || children.length < 1) {
      return NextResponse.json(
        { error: "Aile odası için en az 1 çocuk bilgisi zorunludur (2 Yetişkin + En az 1 Çocuk yapısı)." },
        { status: 400 }
      );
    }

    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (!c?.firstName?.trim() || !c?.lastName?.trim() || !c?.tcKimlik?.trim() || !c?.birthDate) {
        return NextResponse.json(
          { error: `${i + 1}. çocuk için Ad, Soyad, TC Kimlik No ve Doğum Tarihi zorunludur.` },
          { status: 400 }
        );
      }
      if (!tcRegex.test(String(c.tcKimlik).trim())) {
        return NextResponse.json(
          { error: `${i + 1}. çocuk için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz.` },
          { status: 400 }
        );
      }
    }
  } else if (capacity === 2 && registrationType === "individual") {
    // 2 Kişilik Oda: Bireysel Kayıt -> 1 adet zorunlu oda arkadaşı tercihi (adı soyadı)
    if (!roommatePreference1?.trim()) {
      return NextResponse.json(
        { error: "2 kişilik oda için oda arkadaşınızın adı soyadı zorunludur." },
        { status: 400 }
      );
    }
  } else if (capacity === 3 && registrationType === "individual") {
    // 3 Kişilik Oda: Bireysel Kayıt -> 2 adet zorunlu oda arkadaşı tercihi
    if (!roommatePreference1?.trim() || !roommatePreference2?.trim()) {
      return NextResponse.json(
        { error: "3 kişilik oda için 1. ve 2. oda arkadaşınızın adı soyadı zorunludur." },
        { status: 400 }
      );
    }
  } else if (capacity === 2 && (registrationType === "room" || clientHasRoommate)) {
    // 2 Kişilik Oda: Toplu Oda Kaydı -> ad, soyad, tc, doğum tarihi, email, telefon zorunlu
    if (
      !roommate?.firstName?.trim() ||
      !roommate?.lastName?.trim() ||
      !roommate?.tcKimlik?.trim() ||
      !roommate?.birthDate ||
      !roommate?.email?.trim() ||
      !roommate?.phone?.trim()
    ) {
      return NextResponse.json(
        { error: "2. kişi (oda arkadaşı) için Ad, Soyad, TC Kimlik No, Doğum Tarihi, E-posta ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    if (!tcRegex.test(String(roommate.tcKimlik).trim())) {
      return NextResponse.json(
        { error: "Oda arkadaşı için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz." },
        { status: 400 }
      );
    }
  } else if (capacity === 3 && (registrationType === "room" || clientHasRoommate)) {
    // 3 Kişilik Oda: Toplu Oda Kaydı -> 2. ve 3. Kişi bilgileri zorunlu
    const thirdGuest = roommate2;

    if (
      !roommate?.firstName?.trim() ||
      !roommate?.lastName?.trim() ||
      !roommate?.tcKimlik?.trim() ||
      !roommate?.birthDate ||
      !roommate?.email?.trim() ||
      !roommate?.phone?.trim()
    ) {
      return NextResponse.json(
        { error: "2. kişi (1. Oda Arkadaşı) için Ad, Soyad, TC Kimlik No, Doğum Tarihi, E-posta ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    if (!tcRegex.test(String(roommate.tcKimlik).trim())) {
      return NextResponse.json(
        { error: "2. kişi için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz." },
        { status: 400 }
      );
    }

    if (
      !thirdGuest?.firstName?.trim() ||
      !thirdGuest?.lastName?.trim() ||
      !thirdGuest?.tcKimlik?.trim() ||
      !thirdGuest?.birthDate ||
      !thirdGuest?.email?.trim() ||
      !thirdGuest?.phone?.trim()
    ) {
      return NextResponse.json(
        { error: "3. kişi (2. Oda Arkadaşı) için Ad, Soyad, TC Kimlik No, Doğum Tarihi, E-posta ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    if (!tcRegex.test(String(thirdGuest.tcKimlik).trim())) {
      return NextResponse.json(
        { error: "3. kişi için geçerli bir 11 haneli T.C. Kimlik Numarası giriniz." },
        { status: 400 }
      );
    }
  }

  // 2. FİYAT VE ODA HESAPLAMA (Server-side Güvenli Hesaplama)
  const isGroupRoomBooking = !isFamily && (registrationType === "room" || !!clientHasRoommate);

  const calculation = calculateReservationPrice({
    adultPrice,
    capacity,
    packageId: pkg.id,
    isFamily,
    hasRoommate: isFamily ? true : isGroupRoomBooking,
    children: isFamily && Array.isArray(children) ? children : [],
  });

  const totalAmount = calculation.totalAmount;
  const remainingCapacity = calculation.remainingCapacity;

  // 3. ODA OLUŞTURMA / GÜNCELLEME
  let roomId: string | null = null;

  if (isFamily || capacity > 1) {
    // Kullanıcının mevcut odası var mı kontrol et
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("room_id")
      .eq("id", user.id)
      .single();

    const roomType = isFamily ? "family" : capacity === 3 ? "triple" : "double";
    const roomCapacity = isFamily ? Math.max(3, 2 + children.length) : capacity;

    if (currentProfile?.room_id) {
      roomId = currentProfile.room_id;
      // Mevcut odayı güncelle
      await admin
        .from("rooms")
        .update({
          capacity: roomCapacity,
          remaining_capacity: remainingCapacity,
          room_type: roomType,
        })
        .eq("id", roomId);

      // Eski misafirleri temizle (yeniden ekleyeceğiz)
      await admin.from("room_guests").delete().eq("room_id", roomId);
    } else {
      // Yeni oda oluştur
      const { data: newRoom, error: roomError } = await admin
        .from("rooms")
        .insert({
          capacity: roomCapacity,
          remaining_capacity: remainingCapacity,
          room_type: roomType,
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
        tc_kimlik?: string | null;
        birth_date: string | null;
        email: string | null;
        phone: string | null;
        gender: string;
        club: string | null;
        age: number | null;
        price: number;
        donor_types?: string[];
      }> = [];

      // AİLE ODASI: 2. Yetişkin + Çocuklar
      if (isFamily) {
        if (adult2) {
          guestsToInsert.push({
            room_id: roomId,
            registered_by: user.id,
            guest_type: "adult",
            first_name: adult2.firstName.trim(),
            last_name: adult2.lastName.trim(),
            tc_kimlik: adult2.tcKimlik ? String(adult2.tcKimlik).trim() : null,
            birth_date: adult2.birthDate || null,
            email: adult2.email ? adult2.email.trim() : null,
            phone: adult2.phone ? adult2.phone.trim() : null,
            gender: adult2.gender || "Kadın",
            club: adult2.club?.trim() || club,
            age: null,
            price: adultPrice,
            donor_types: Array.isArray(adult2.donorTypes) ? adult2.donorTypes : [],
          });
        }

        if (Array.isArray(children)) {
          for (const child of children) {
            const childAge = child.birthDate ? calculateChildAge(child.birthDate) : null;
            const childItem = calculation.items.find(
              (it) => it.label.includes(child.firstName) || it.label.includes("Çocuk")
            );

            guestsToInsert.push({
              room_id: roomId,
              registered_by: user.id,
              guest_type: "child",
              first_name: child.firstName.trim(),
              last_name: child.lastName.trim(),
              tc_kimlik: child.tcKimlik ? String(child.tcKimlik).trim() : null,
              birth_date: child.birthDate || null,
              email: null,
              phone: null,
              gender: child.gender || "Erkek",
              club: null,
              age: childAge,
              price: childItem?.total ?? 0,
            });
          }
        }
      } else if (isGroupRoomBooking) {
        // 2 Kişilik odada oda arkadaşı
        if (capacity === 2 && roommate) {
          guestsToInsert.push({
            room_id: roomId,
            registered_by: user.id,
            guest_type: "adult",
            first_name: roommate.firstName.trim(),
            last_name: roommate.lastName.trim(),
            tc_kimlik: roommate.tcKimlik ? String(roommate.tcKimlik).trim() : null,
            birth_date: roommate.birthDate || null,
            email: roommate.email ? roommate.email.trim() : null,
            phone: roommate.phone ? roommate.phone.trim() : null,
            gender: roommate.gender || "Erkek",
            club: roommate.club?.trim() || club,
            age: null,
            price: adultPrice,
            donor_types: Array.isArray(roommate.donorTypes) ? roommate.donorTypes : [],
          });
        }

        // 3 Kişilik odada 2. ve 3. Kişi (Oda Arkadaşları)
        if (capacity === 3 && roommate) {
          const thirdGuest = roommate2;

          guestsToInsert.push({
            room_id: roomId,
            registered_by: user.id,
            guest_type: "adult",
            first_name: roommate.firstName.trim(),
            last_name: roommate.lastName.trim(),
            tc_kimlik: roommate.tcKimlik ? String(roommate.tcKimlik).trim() : null,
            birth_date: roommate.birthDate || null,
            email: roommate.email ? roommate.email.trim() : null,
            phone: roommate.phone ? roommate.phone.trim() : null,
            gender: roommate.gender || "Erkek",
            club: roommate.club?.trim() || club,
            age: null,
            price: adultPrice,
            donor_types: Array.isArray(roommate.donorTypes) ? roommate.donorTypes : [],
          });

          if (thirdGuest) {
            guestsToInsert.push({
              room_id: roomId,
              registered_by: user.id,
              guest_type: "adult",
              first_name: thirdGuest.firstName.trim(),
              last_name: thirdGuest.lastName.trim(),
              tc_kimlik: thirdGuest.tcKimlik ? String(thirdGuest.tcKimlik).trim() : null,
              birth_date: thirdGuest.birthDate || null,
              email: thirdGuest.email ? thirdGuest.email.trim() : null,
              phone: thirdGuest.phone ? thirdGuest.phone.trim() : null,
              gender: thirdGuest.gender || "Kadın",
              club: thirdGuest.club?.trim() || club,
              age: null,
              price: adultPrice,
              donor_types: Array.isArray(thirdGuest.donorTypes) ? thirdGuest.donorTypes : [],
            });
          }
        }
      }

      if (guestsToInsert.length > 0) {
        let { error: guestError } = await admin
          .from("room_guests")
          .insert(guestsToInsert);

        if (guestError && (guestError.message?.toLowerCase().includes("tc_kimlik") || guestError.message?.toLowerCase().includes("donor_types"))) {
          console.warn("[complete-profile] Fallback: tc_kimlik or donor_types column not found in room_guests. Retrying without them. Please run migrations 00015 and 00018.");
          const fallbackGuests = guestsToInsert.map((g) => {
            const { tc_kimlik: _, donor_types: __, ...rest } = g;
            return rest;
          });
          const retryRes = await admin.from("room_guests").insert(fallbackGuests);
          guestError = retryRes.error;
        }

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
    tc_kimlik: String(tcKimlik).trim(),
    birth_date: birthDate,
    phone,
    club,
    gender,
    package_id: packageId,
    pricing_type: pricingType,
    total_amount: totalAmount,
    has_roommate: isFamily ? true : isGroupRoomBooking,
    room_registration_type: isFamily ? "room" : registrationType,
    roommate_preference_1: (!isFamily && registrationType === "individual") ? (roommatePreference1?.trim() || null) : null,
    roommate_preference_2: (!isFamily && capacity === 3 && registrationType === "individual") ? (roommatePreference2?.trim() || null) : null,
    donor_types: Array.isArray(donorTypes) ? donorTypes : [],
    guest_count: isFamily
      ? 1 + children.length
      : capacity === 2 && isGroupRoomBooking
      ? 1
      : capacity === 3 && isGroupRoomBooking
      ? 2
      : 0,
  };

  if (roomId) {
    profileUpdate.room_id = roomId;
  }
  if (duty) {
    profileUpdate.gorev = duty;
  }

  let { error: updateError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (
    updateError &&
    (updateError.message?.toLowerCase().includes("tc_kimlik") ||
      updateError.message?.toLowerCase().includes("birth_date") ||
      updateError.message?.toLowerCase().includes("donor_types") ||
      updateError.message?.toLowerCase().includes("room_registration_type") ||
      updateError.message?.toLowerCase().includes("roommate_preference"))
  ) {
    console.warn(
      "[complete-profile] Fallback: Missing columns in profiles. Retrying without new columns. Please run migration 00018."
    );
    const fallbackProfile = { ...profileUpdate };
    delete fallbackProfile.tc_kimlik;
    delete fallbackProfile.birth_date;
    delete fallbackProfile.donor_types;
    delete fallbackProfile.room_registration_type;
    delete fallbackProfile.roommate_preference_1;
    delete fallbackProfile.roommate_preference_2;
    const retryRes = await admin
      .from("profiles")
      .update(fallbackProfile)
      .eq("id", user.id);
    updateError = retryRes.error;
  }

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
