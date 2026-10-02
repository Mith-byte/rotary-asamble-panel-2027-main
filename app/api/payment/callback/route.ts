import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Sanal POS Ödeme Callback (Webhook) Endpoint'i
 *
 * Bu endpoint, sanal POS sağlayıcısı tarafından ödeme tamamlandığında
 * arka planda (server-to-server) çağrılır.
 *
 * Güvenlik:
 *  - HASH_SECRET ile imza doğrulaması yapılır.
 *  - Sadece doğrulanan istekler işleme alınır.
 *
 * Kullanım: Sanal POS panelinizde "Bildirim URL'si" veya
 * "Callback URL" alanına bu endpoint'in tam adresini girin:
 *   https://sizin-domaininiz.com/api/payment/callback
 *
 * ⚠️  HASH_SECRET değişkenini .env.local'e eklemeyi unutmayın:
 *   PAYMENT_HASH_SECRET=sanal_pos_panelinizden_aldiginiz_secret
 */

const PAYMENT_HASH_SECRET = process.env.PAYMENT_HASH_SECRET ?? "";

/**
 * PayTR / Iyzico / Param tarzı hash doğrulama.
 * Sağlayıcınızın dokümantasyonuna göre bu fonksiyonu uyarlayın.
 */
function verifySignature(body: Record<string, string>): boolean {
  // Eğer secret tanımlı değilse (geliştirme ortamı), doğrulamayı atla
  if (!PAYMENT_HASH_SECRET) {
    console.warn("[payment/callback] PAYMENT_HASH_SECRET tanımlı değil, imza doğrulaması atlanıyor.");
    return true;
  }

  // Örnek: PayTR hash doğrulama mantığı
  // Sağlayıcınızın belirlediği parametrelerle hash'i kendiniz oluşturun
  // ve gelen hash ile karşılaştırın.
  const { hash, merchant_oid, status, total_amount } = body;
  if (!hash) return false;

  const hashStr = `${merchant_oid}${PAYMENT_HASH_SECRET}${status}${total_amount}`;
  const expectedHash = crypto
    .createHmac("sha256", PAYMENT_HASH_SECRET)
    .update(hashStr)
    .digest("base64");

  return hash === expectedHash;
}

export async function POST(request: NextRequest) {
  let body: Record<string, string>;

  // POS sağlayıcıları genellikle form-urlencoded gönderir
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    body = await request.json();
  }

  console.log("[payment/callback] Gelen veri:", body);

  // İmza doğrulama
  if (!verifySignature(body)) {
    console.error("[payment/callback] İmza doğrulama başarısız.");
    return new NextResponse("INVALID_SIGNATURE", { status: 403 });
  }

  // POS sağlayıcısından gelen temel alanlar
  // Bu alanları kendi sağlayıcınızın dokümantasyonuna göre uyarlayın
  const {
    merchant_oid,       // Bizim oluşturduğumuz sipariş numarası (user_id içermeli)
    status,             // "success" veya "failed"
    total_amount,       // Ödenen tutar (kuruş veya TL - sağlayıcıya göre değişir)
    payment_id,         // POS'un işlem ID'si
  } = body;

  if (!merchant_oid || !status) {
    return new NextResponse("MISSING_PARAMS", { status: 400 });
  }

  const admin = createAdminClient();

  // merchant_oid formatı: "usr_{userId}_{timestamp}"
  // Kullanıcı ID'sini çıkar
  const userIdMatch = merchant_oid.match(/^usr_([a-f0-9-]{36})_/);
  if (!userIdMatch) {
    console.error("[payment/callback] Geçersiz merchant_oid formatı:", merchant_oid);
    return new NextResponse("INVALID_ORDER_ID", { status: 400 });
  }
  const userId = userIdMatch[1];

  const paymentSucceeded = status === "success";
  const amount = parseFloat(total_amount ?? "0") || 0;

  // payment_transactions tablosuna kaydet
  const { error: txError } = await admin
    .from("payment_transactions")
    .insert({
      user_id: userId,
      amount: amount,
      currency: "TRY",
      pos_transaction_id: payment_id ?? null,
      merchant_order_id: merchant_oid,
      status: paymentSucceeded ? "completed" : "failed",
      pos_response: body,
    });

  if (txError) {
    console.error("[payment/callback] İşlem kaydedilemedi:", txError);
    // POS sağlayıcılarına 200 dönmek önemli, aksi halde tekrar deneyebilirler
    return new NextResponse("OK", { status: 200 });
  }

  // Eğer ödeme başarılıysa kullanıcı profilini güncelle
  if (paymentSucceeded) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ status: "accepted" })
      .eq("id", userId);

    if (profileError) {
      console.error("[payment/callback] Profil güncellenemedi:", profileError);
    } else {
      console.log(`[payment/callback] Kullanıcı onaylandı: ${userId}`);
    }
  }

  // POS sağlayıcıları genellikle "OK" metni bekler
  return new NextResponse("OK", { status: 200 });
}

/**
 * GET: Sanal POS bazı sağlayıcılar endpoint'in ayakta olduğunu doğrulamak
 * için GET isteği atar.
 */
export async function GET() {
  return new NextResponse("Payment callback endpoint active.", { status: 200 });
}
