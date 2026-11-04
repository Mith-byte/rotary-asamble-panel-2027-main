import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * İş Bankası "İş'le Öde" Callback & Webhook API Rotası
 *
 * Mimari:
 * 1. Eski Nestpay HTML form ve hashparams doğrulamasını kaldırır.
 * 2. Bankanın 'İş'le Öde' servisinden gelen JSON Webhook veya kullanıcı yönlendirme (Browser Return)
 *    isteklerini karşılar.
 * 3. İşlem başarılıysa ('SUCCESS', 'COMPLETED', 'PAID', '00' vb.):
 *    - payment_transactions tablosunu 'completed' olarak günceller.
 *    - profiles.status değerini 'accepted' yapar.
 *    - Webhook ise JSON { status: "OK" } yanıtı döner; tarayıcı yönlendirmesi ise /odeme/basarili sayfasına aktarır.
 * 4. Başarısız ise:
 *    - payment_transactions tablosunu 'failed' olarak günceller.
 *    - Webhook ise JSON hata yanıtı döner; tarayıcı ise /odeme/hata sayfasına aktarır.
 */
async function handleCallback(request: NextRequest) {
  // 1. RATE LIMITING KORUMASI
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_callback_${clientIp}`, 40, 60_000);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://asamble2440.com";

  if (!rateLimit.allowed) {
    console.warn(`[payment/callback] Rate limit aşıldı! IP: ${clientIp}`);
    return isWebhookRequest(request)
      ? NextResponse.json({ error: "Too many requests" }, { status: 429 })
      : redirectTo("/odeme/hata?error=Cok_fazla_istek_Lutfen_bekleyin", siteUrl);
  }

  // 2. GELEN VERİYİ AYIKLA (JSON, Form-Data veya URL Query Params)
  let rawData: Record<string, any> = {};

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      rawData = await request.json();
    } catch (e) {
      console.warn("[payment/callback] JSON parse hatası:", e);
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        rawData[key] = value.toString();
      });
    } catch (e) {
      console.warn("[payment/callback] FormData parse hatası:", e);
    }
  }

  // URL query parametrelerini de harmanla (GET veya redirect dönüşleri için)
  request.nextUrl.searchParams.forEach((value, key) => {
    if (rawData[key] === undefined) {
      rawData[key] = value;
    }
  });

  console.log("[payment/callback] İş'le Öde gelen bildirim verisi:", rawData);

  // 3. TEMEL ALANLARI HARİTALAMA (Mapping)
  const oid = (
    rawData.orderId ||
    rawData.merchantOrderId ||
    rawData.merchantReferenceCode ||
    rawData.oid ||
    rawData.ReturnOid ||
    ""
  ).toString().trim();

  const statusRaw = (
    rawData.status ||
    rawData.paymentStatus ||
    rawData.resultCode ||
    rawData.Response ||
    rawData.transactionStatus ||
    ""
  ).toString().trim().toUpperCase();

  const transId = (
    rawData.transactionId ||
    rawData.paymentId ||
    rawData.transId ||
    rawData.TransId ||
    rawData.token ||
    ""
  ).toString().trim();

  const errMsg = (
    rawData.errorMessage ||
    rawData.resultMessage ||
    rawData.ErrMsg ||
    rawData.error ||
    rawData.message ||
    ""
  ).toString().trim();

  const admin = createAdminClient();

  // 4. VERİTABANI İŞLEM KAYDI KONTROLÜ
  let existingTx: { id: string; user_id: string; amount: number; status: string } | null = null;

  if (oid) {
    const { data: tx } = await admin
      .from("payment_transactions")
      .select("id, user_id, amount, status")
      .eq("merchant_order_id", oid)
      .maybeSingle();

    if (tx) {
      existingTx = tx as any;
    }
  }

  // REPLAY ATTACK KORUMASI: Daha önce tamamlandıysa mükerrer işlem yapma
  if (existingTx && (existingTx.status === "completed" || (existingTx.status as string) === "paid")) {
    console.log(`[payment/callback] Mükerrer bildirim (Idempotent): OID ${oid} zaten tamamlanmış.`);
    return isWebhookRequest(request)
      ? NextResponse.json({ status: "OK", alreadyProcessed: true, orderId: oid })
      : redirectTo(`/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`, siteUrl);
  }

  // 5. BAŞARI KONTROLÜ
  // 'İş'le Öde' başarı kodları: SUCCESS, COMPLETED, PAID, APPROVED, 00, 0, OK veya isSuccess === true
  const successCodes = ["SUCCESS", "COMPLETED", "PAID", "APPROVED", "00", "0", "OK"];
  const isPaymentSuccess = successCodes.includes(statusRaw) || rawData.isSuccess === true;

  // Kullanıcı kimliği
  let userId: string | null = existingTx?.user_id || null;
  if (!userId) {
    const match = oid.match(/^usr_([a-f0-9-]{36})_/);
    if (match) {
      userId = match[1];
    }
  }

  // 6. İŞLEM BAŞARILI İSE (SUCCESS / COMPLETED)
  if (isPaymentSuccess) {
    console.log(`[payment/callback] Ödeme başarıyla onaylandı: OID=${oid}, TransId=${transId}`);

    if (oid) {
      const { error: txUpdateError } = await admin
        .from("payment_transactions")
        .update({
          status: "completed",
          pos_transaction_id: transId || null,
          pos_response: rawData,
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_order_id", oid);

      if (txUpdateError) {
        console.error("[payment/callback] payment_transactions güncelleme hatası:", txUpdateError.message);
      }
    }

    if (userId) {
      const { error: profUpdateError } = await admin
        .from("profiles")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profUpdateError) {
        console.error("[payment/callback] Profil status güncelleme hatası:", profUpdateError.message);
      }
    }

    // Server-to-server Webhook ise JSON yanıtı dön
    if (isWebhookRequest(request)) {
      return NextResponse.json({
        status: "OK",
        orderId: oid,
        message: "Payment confirmed successfully",
      });
    }

    // Tarayıcı yönlendirmesi ise Başarılı Sayfasına yönlendir
    return redirectTo(
      `/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`,
      siteUrl
    );
  }

  // 7. İŞLEM BAŞARISIZ İSE (FAILED)
  const failureReason = errMsg || `Ödeme tamamlanamadı (Banka Durumu: ${statusRaw || "Bilinmiyor"}).`;
  console.warn(`[payment/callback] Ödeme başarısız: OID=${oid}, Neden=${failureReason}`);

  if (oid) {
    await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        pos_transaction_id: transId || null,
        pos_response: rawData,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_order_id", oid);
  }

  // Webhook ise JSON dön
  if (isWebhookRequest(request)) {
    return NextResponse.json(
      {
        status: "FAILED",
        orderId: oid,
        error: failureReason,
      },
      { status: 400 }
    );
  }

  // Tarayıcı yönlendirmesi ise Hata Sayfasına yönlendir
  return redirectTo(
    `/odeme/hata?oid=${encodeURIComponent(oid)}&error=${encodeURIComponent(failureReason)}`,
    siteUrl
  );
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

/**
 * İsteğin server-to-server Webhook mu yoksa kullanıcının tarayıcı yönlendirmesi mi olduğunu belirler.
 */
function isWebhookRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";

  // Tarayıcılar genelde Accept: text/html,... gönderir. Webhook servisleri ise application/json gönderir.
  if (contentType.includes("application/json") && !accept.includes("text/html")) {
    return true;
  }
  return false;
}

/**
 * Güvenli ve cross-origin uyumlu HTTP 303 (See Other) Yönlendirmesi
 */
function redirectTo(path: string, siteUrl: string) {
  const url = new URL(path, siteUrl);
  return NextResponse.redirect(url, 303);
}
