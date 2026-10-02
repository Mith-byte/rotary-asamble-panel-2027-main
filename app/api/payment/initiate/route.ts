import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ödeme başlatma endpoint'i.
 *
 * Kullanıcı "Kredi Kartı ile Öde" butonuna bastığında bu endpoint çağrılır.
 * Sağlayıcınızın API'sine istek atarak:
 *   1. Benzersiz bir sipariş numarası (merchant_oid) oluşturur.
 *   2. POS ödeme formunun URL'sini veya token'ını döner.
 *   3. Kullanıcı tarayıcısını POS ödeme sayfasına yönlendirir.
 *
 * Sağlayıcınıza göre bu endpoint'in içini doldurun.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("status, pricing_type, packages!package_id(early_bird_price, round_1_price, round_2_price)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
  }

  if (profile.status === "accepted") {
    return NextResponse.json({ error: "Ödeme zaten tamamlanmış" }, { status: 400 });
  }

  const pkg = profile.packages as any;
  const pricingType = profile.pricing_type ?? "early_bird";
  const amount: number = pkg?.[`${pricingType}_price`] ?? 0;

  if (!amount) {
    return NextResponse.json({ error: "Ödeme tutarı belirlenemedi" }, { status: 400 });
  }

  // Sipariş numarası: "usr_{userId}_{timestamp}"
  // Callback'te bu numaradan userId'yi çıkaracağız
  const merchantOid = `usr_${user.id}_${Date.now()}`;

  // -----------------------------------------------------------------------
  // TODO: Buraya seçtiğiniz sanal POS sağlayıcısının API entegrasyonunu
  // ekleyin. Aşağıda örnek bir yapı verilmiştir:
  //
  // const posResponse = await fetch("https://pos-api-endpoint.com/initiate", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     merchant_id: process.env.POS_MERCHANT_ID,
  //     merchant_oid: merchantOid,
  //     amount: amount * 100, // kuruş cinsinden
  //     currency: "TL",
  //     callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/callback`,
  //     success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/odemeler?status=success`,
  //     fail_url: `${process.env.NEXT_PUBLIC_SITE_URL}/odemeler?status=failed`,
  //   }),
  // });
  // const posData = await posResponse.json();
  // return NextResponse.json({ redirect_url: posData.payment_url });
  // -----------------------------------------------------------------------

  // Şimdilik: Geçici sanal POS linkine yönlendir
  const POS_URL = process.env.NEXT_PUBLIC_VPOS_URL ?? "https://sanal-pos-linki-gelecek.com";

  return NextResponse.json({
    redirect_url: POS_URL,
    merchant_oid: merchantOid,
    amount,
  });
}
