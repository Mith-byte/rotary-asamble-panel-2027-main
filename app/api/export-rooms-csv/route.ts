import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { findMatchingUser, CandidateUser } from "@/lib/room-matching";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Yönetici yetki kontrolü
  const isAdmin = isAdminEmail(user.email);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Tüm odaları oluşturulma tarihine göre çek
  const { data: allRooms } = await admin
    .from("rooms")
    .select("id, capacity, remaining_capacity, created_by, created_at")
    .order("created_at", { ascending: true });

  const rooms = allRooms ?? [];
  const roomIds = rooms.map((r) => r.id);

  // 2. Odalara bağlı profilleri, misafirleri ve tüm katılımcıları çek
  const [{ data: allProfiles }, { data: allGuests }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, first_name, last_name, tc_kimlik, birth_date, gender, phone, email, club, gorev, package_id, room_id, status, room_registration_type, roommate_preference_1, roommate_preference_2, packages!package_id(name, capacity)")
      .not("first_name", "is", null),
    admin
      .from("room_guests")
      .select("id, room_id, registered_by, guest_type, first_name, last_name, phone, email, gender, club, birth_date, age, tc_kimlik"),
  ]);

  const profilesList = allProfiles ?? [];
  const guestsList = allGuests ?? [];

  // Profilleri ID'ye ve room_id'ye göre indeksle
  const profilesById = new Map<string, (typeof profilesList)[0]>();
  const profilesByRoom = new Map<string, (typeof profilesList)[0][]>();
  for (const p of profilesList) {
    profilesById.set(p.id, p);
    if (p.room_id) {
      const list = profilesByRoom.get(p.room_id) ?? [];
      list.push(p);
      profilesByRoom.set(p.room_id, list);
    }
  }

  // Misafirleri room_id'ye göre indeksle
  const guestsByRoom = new Map<string, (typeof guestsList)[0][]>();
  for (const g of guestsList) {
    if (g.room_id) {
      const list = guestsByRoom.get(g.room_id) ?? [];
      list.push(g);
      guestsByRoom.set(g.room_id, list);
    }
  }

  // Tek kişilik paket kullanıcıları (oda kaydı açılmayan solo paketler)
  const soloProfiles = profilesList.filter((p) => {
    const pkg = p.packages as unknown as { capacity: number } | null;
    return !p.room_id && pkg?.capacity === 1;
  });

  // 3. Oda Numaralandırmasını hazırla (Eşleştirme durumunda Oda No: X göstermek için)
  const userRoomNumberMap = new Map<string, number>();
  let roomCounter = 1;

  // Standart odaları numaralandır
  const roomNumberMap = new Map<string, number>();
  for (const r of rooms) {
    const roomNum = roomCounter++;
    roomNumberMap.set(r.id, roomNum);

    const roomProfs = profilesByRoom.get(r.id) ?? [];
    for (const p of roomProfs) {
      userRoomNumberMap.set(p.id, roomNum);
    }
  }

  // Solo odaları numaralandır
  const soloRoomNumberMap = new Map<string, number>();
  for (const sp of soloProfiles) {
    const roomNum = roomCounter++;
    soloRoomNumberMap.set(sp.id, roomNum);
    userRoomNumberMap.set(sp.id, roomNum);
  }

  // 4. Eşleştirme için Aday Katılımcı Listesi
  const candidates: CandidateUser[] = profilesList.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    room_id: p.room_id,
    room_number: userRoomNumberMap.get(p.id) ?? null,
  }));

  // CSV escape fonksiyonu (Noktalı virgül ve formül enjeksiyonu korumalı)
  const escapeField = (val?: string | number | null) => {
    if (val == null) return "";
    let clean = String(val).trim();
    if (/^[=+\-@\t\r]/.test(clean)) {
      clean = `'${clean}`;
    }
    if (clean.includes(";") || clean.includes('"') || clean.includes("\n") || clean.includes("\r")) {
      return `"${clean.replace(/"/g, '""')}"`;
    }
    return clean;
  };

  const headers = [
    "Oda No",
    "Paket Adı",
    "Oda Kapasitesi",
    "Oda Durumu",
    "Kayıt Tipi",
    "Katılımcı Rolü",
    "Ad Soyad",
    "TC Kimlik No",
    "Doğum Tarihi",
    "Cinsiyet",
    "Telefon",
    "E-posta",
    "Beyan Edilen Oda Arkadaşları",
    "Eşleşme Durumu",
    "Ödeme Durumu",
  ];

  const rows: string[] = [];

  // 5. Standart Odaları Satırlara Dök
  for (const room of rooms) {
    const roomNum = roomNumberMap.get(room.id) ?? 0;
    const roomProfs = profilesByRoom.get(room.id) ?? [];
    const roomGuests = guestsByRoom.get(room.id) ?? [];

    const creator = room.created_by ? profilesById.get(room.created_by) : null;
    const firstMemberPkg = (roomProfs[0]?.packages as unknown as { name: string })?.name;
    const creatorPkg = (creator?.packages as unknown as { name: string })?.name;
    const packageName = creatorPkg || firstMemberPkg || "Konaklama Paketi";

    const totalOccupants = roomProfs.length + roomGuests.length;
    const isFull =
      (room.remaining_capacity !== undefined && room.remaining_capacity === 0) ||
      totalOccupants >= room.capacity;

    const remainingSlots = Math.max(0, room.capacity - totalOccupants);
    const roomStatusText = isFull ? "Dolu" : `Boş Yer Var (${remainingSlots} Kişilik)`;

    const isRoomBooking = creator?.room_registration_type === "room";
    const regTypeText = isRoomBooking ? "Oda Kaydı (Tüm Oda)" : "Bireysel Kayıt";

    // Beyan edilen oda arkadaşı tercihleri (Kurucudan veya odadaki bireysel üyeden)
    const primaryProfile = creator || roomProfs[0];
    const declaredPreferences = [
      primaryProfile?.roommate_preference_1,
      primaryProfile?.roommate_preference_2,
    ].filter(Boolean) as string[];

    const declaredText = declaredPreferences.length > 0 ? declaredPreferences.join(" & ") : "—";

    // Eşleşme durumu hesaplama fonksiyonu
    const getMatchStatus = (pref: string) => {
      const match = findMatchingUser(pref, candidates, primaryProfile?.id);
      if (match && match.room_number) {
        return `Karşılıklı Kayıt Mevcut (Oda No: ${match.room_number})`;
      } else if (match) {
        return "Karşılıklı Kayıt Mevcut (Oda Atanmamış)";
      }
      return "Kayıt Bekleniyor";
    };

    let overallMatchStatus = "—";
    if (!isRoomBooking && declaredPreferences.length > 0) {
      overallMatchStatus = declaredPreferences
        .map((p) => (declaredPreferences.length > 1 ? `${p}: ${getMatchStatus(p)}` : getMatchStatus(p)))
        .join(" | ");
    }

    // A. Odadaki Profiller (Kurucu ve Eklenen Üyeler)
    // Kurucuyu her zaman en üste al
    const sortedProfs = [...roomProfs].sort((a, b) => {
      if (a.id === room.created_by) return -1;
      if (b.id === room.created_by) return 1;
      return 0;
    });

    for (const p of sortedProfs) {
      const isCreator = p.id === room.created_by;
      const roleText = isCreator ? "Kurucu" : "Oda Arkadaşı";
      const paymentText = p.status === "accepted" ? "Ödendi" : "Ödeme Bekliyor";
      const tcText = p.tc_kimlik ? `'${p.tc_kimlik}` : "—";
      const phoneText = p.phone ? `+${p.phone}` : "—";

      rows.push(
        [
          `Oda ${roomNum}`,
          packageName,
          room.capacity,
          roomStatusText,
          regTypeText,
          roleText,
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          tcText,
          p.birth_date ?? "—",
          p.gender ?? "—",
          phoneText,
          p.email ?? "—",
          isCreator ? declaredText : "—",
          isCreator ? overallMatchStatus : "—",
          paymentText,
        ]
          .map(escapeField)
          .join(";")
      );
    }

    // B. Odadaki Misafirler (Toplu Oda kaydı veya aile misafirleri)
    for (const g of roomGuests) {
      const roleText =
        g.guest_type === "child"
          ? `Çocuk (${g.age ?? 0} Yaş)`
          : "Oda Arkadaşı (2. Yetişkin)";
      const paymentText = creator?.status === "accepted" ? "Ödendi" : "Ödeme Bekliyor";
      const tcText = g.tc_kimlik ? `'${g.tc_kimlik}` : "—";
      const phoneText = g.phone ? `+${g.phone}` : "—";

      rows.push(
        [
          `Oda ${roomNum}`,
          packageName,
          room.capacity,
          roomStatusText,
          regTypeText,
          roleText,
          `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim(),
          tcText,
          g.birth_date ?? "—",
          g.gender ?? "—",
          phoneText,
          g.email ?? "—",
          "—",
          "—",
          paymentText,
        ]
          .map(escapeField)
          .join(";")
      );
    }

    // C. Boş Koltuklar (Varsa acente için beklenen oda arkadaşı / boş yer satırı)
    if (remainingSlots > 0) {
      // Eğer beyan edilen isimlerden henüz odaya eklenmemiş olanlar varsa
      for (let slotIndex = 0; slotIndex < remainingSlots; slotIndex++) {
        const expectedName = declaredPreferences[slotIndex];
        const roleText = expectedName
          ? "Beklenen Oda Arkadaşı (Boş Yer)"
          : "Boş Yer (Atanmadı)";
        const personName = expectedName ? expectedName : "—";
        const slotMatchStatus = expectedName ? getMatchStatus(expectedName) : "—";

        rows.push(
          [
            `Oda ${roomNum}`,
            packageName,
            room.capacity,
            roomStatusText,
            regTypeText,
            roleText,
            personName,
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            slotMatchStatus,
            "—",
          ]
            .map(escapeField)
            .join(";")
        );
      }
    }
  }

  // 6. Tek Kişilik Paketler (Solo Odalar)
  for (const sp of soloProfiles) {
    const roomNum = soloRoomNumberMap.get(sp.id) ?? 0;
    const pkgName = (sp.packages as unknown as { name: string })?.name ?? "Tek Kişilik Konaklama";
    const paymentText = sp.status === "accepted" ? "Ödendi" : "Ödeme Bekliyor";
    const tcText = sp.tc_kimlik ? `'${sp.tc_kimlik}` : "—";
    const phoneText = sp.phone ? `+${sp.phone}` : "—";

    rows.push(
      [
        `Oda ${roomNum}`,
        pkgName,
        1,
        "Dolu",
        "Bireysel Kayıt",
        "Kurucu (Tek Kişilik)",
        `${sp.first_name ?? ""} ${sp.last_name ?? ""}`.trim(),
        tcText,
        sp.birth_date ?? "—",
        sp.gender ?? "—",
        phoneText,
        sp.email ?? "—",
        "—",
        "—",
        paymentText,
      ]
        .map(escapeField)
        .join(";")
    );
  }

  // 7. UTF-8 BOM ve Noktalı Virgül (;) Ayraçlı CSV Çıktısı
  const bom = "\uFEFF";
  const csvContent = bom + [headers.map(escapeField).join(";"), ...rows].join("\r\n");

  const dateStr = new Date().toISOString().slice(0, 10);
  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oda-dagilim-raporu-${dateStr}.csv"`,
    },
  });
}
