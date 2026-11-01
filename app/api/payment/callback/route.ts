import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Zamanlama Analizi (Timing Attack) Korumalı Güvenli String Karşılaştırma
 */
function safeTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * İş Bankası Sanal POS (Nestpay / Est3D) Callback (Geri Dönüş) API Rotası
 *
 * Güvenlik Standartları:
 * 1. Rate Limiting: IP başına dakikada maksimum 30 istek (Brute-force / Callback flooding önleme)
 * 2. Fail-Closed İmza Doğrulaması: ISBANK_STORE_KEY yoksa kesinlikle işlem onaylanmaz.
 * 3. Timing-Safe Hash Doğrulama: Yan-kanal (side-channel) saldırılarına karşı timingSafeEqual.
 * 4. Tutar (Amount) Doğrulaması: Bankanın bildirdiği tutar ile siparişteki tutar tam eşleşmeli.
 * 5. Replay Attack Koruması: Zaten tamamlanmış sipariş mükerrer işleme alınmaz (Idempotency).
 * 6. mdStatus ve Banka Yanıt Kodu Kontrolü.
 */
export async function POST(request: NextRequest) {
  // 1. RATE LIMITING KORUMASI
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_callback_${clientIp}`, 30, 60_000);

  if (!rateLimit.allowed) {
    console.warn(`[payment/callback] Rate limit aşıldı! IP: ${clientIp}`);
    return redirectTo("/odeme/hata?error=Cok_fazla_istek_Lutfen_bekleyin", request);
  }

  let formData: FormData;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      formData = await request.formData();
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      formData = new FormData();
      for (const [key, value] of params.entries()) {
        formData.set(key, value);
      }
    }
  } catch (err) {
    console.error("[payment/callback] FormData parse hatası:", err);
    return redirectTo("/odeme/hata?error=Gecersiz_istek_formati", request);
  }

  // Gelen tüm parametreleri obje olarak topla
  const rawParams: Record<string, string> = {};
  formData.forEach((value, key) => {
    rawParams[key] = value.toString();
  });

  console.log("[payment/callback] Bankadan gelen parametreler:", {
    oid: rawParams.oid || rawParams.ReturnOid,
    mdStatus: rawParams.mdStatus,
    Response: rawParams.Response,
    ProcReturnCode: rawParams.ProcReturnCode,
    ErrMsg: rawParams.ErrMsg,
  });

  // Temel alanları ayıkla
  const oid = (rawParams.oid || rawParams.ReturnOid || "").trim();
  const mdStatus = (rawParams.mdStatus || "").trim();
  const responseCode = (rawParams.Response || "").trim();
  const procReturnCode = (rawParams.ProcReturnCode || "").trim();
  const transId = (rawParams.TransId || "").trim();
  const errMsg = (rawParams.ErrMsg || "").trim();
  const bankHash = (rawParams.HASH || rawParams.hash || "").trim();
  const hashparams = (rawParams.HASHPARAMS || rawParams.hashparams || "").trim();
  const hashparamsval = (rawParams.HASHPARAMSVAL || rawParams.hashparamsval || "").trim();

  const storeKey = (process.env.ISBANK_STORE_KEY || "").trim();

  // 2. NESTPAY İMZA (HASH) DOĞRULAMASI (FAIL-CLOSED)
  let isHashValid = false;

  if (!storeKey) {
    // GÜVENLİK: Asla fail-open olamaz! Store key yoksa işlem reddedilmeli.
    console.error("[payment/callback] KRİTİK GÜVENLİK HATASI: ISBANK_STORE_KEY tanımlı değil!");
    return redirectTo(`/odeme/hata?oid=${encodeURIComponent(oid)}&error=Sistem_yapilandirma_hatasi`, request);
  }

  if (!bankHash) {
    console.error("[payment/callback] Bankadan HASH parametresi gelmedi!");
    isHashValid = false;
  } else {
    let digest = "";

    if (hashparams) {
      const paramList = hashparams.split(":");
      for (const param of paramList) {
        if (!param) continue;
        const val = rawParams[param] ?? "";
        digest += val;
      }
      digest += storeKey;
    } else if (hashparamsval) {
      digest = hashparamsval + storeKey;
    }

    if (digest) {
      const sha512Hash = crypto.createHash("sha512").update(digest, "utf-8").digest("base64");
      const sha1Hash = crypto.createHash("sha1").update(digest, "utf-8").digest("base64");

      // Timing Attack Korumalı karşılaştırma
      if (safeTimingCompare(bankHash, sha512Hash) || safeTimingCompare(bankHash, sha1Hash)) {
        isHashValid = true;
      } else {
        console.error("[payment/callback] Güvenlik Uyarısı: İmza uyuşmazlığı tespit edildi!", {
          oid,
          bankHash,
          calculatedSha512: sha512Hash,
        });
      }
    }
  }

  // 3. MDSTATUS VE BANKA ONAY KONTROLÜ
  // 1: Tam 3D Onayı
  // 2: Kart sahibi sisteme kayıtlı değil (Banka 3D destekliyor)
  // 3: Kart bankası 3D desteklemiyor
  // 4: 3D denemesi yapıldı ancak kart sahibi dahil değil
  const validMdStatuses = ["1", "2", "3", "4"];
  const isMdStatusSuccess = validMdStatuses.includes(mdStatus);
  const isResponseApproved =
    responseCode.toLowerCase() === "approved" || procReturnCode === "00" || (!responseCode && procReturnCode !== "99");

  const admin = createAdminClient();

  // 4. VERİTABANI İŞLEM KAYDI KONTROLÜ & TUTAR DOĞRULAMASI
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

  // REPLAY ATTACK KORUMASI: Eğer işlem daha önce başarıyla tamamlanmışsa mükerrer işlem yapma
  if (existingTx && (existingTx.status === "completed" || (existingTx.status as string) === "paid")) {
    console.log(`[payment/callback] Mükerrer istek engellendi (Idempotent): OID ${oid} zaten tamamlanmış.`);
    return redirectTo(`/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`, request);
  }

  // TUTAR MANİPÜLASYONU KONTROLÜ (Price Tampering Check):
  // Bankadan dönen tutar ile veritabanında saklanan beklenen tutar tam eşleşmeli
  const bankAmountRaw = rawParams.amount || rawParams.Amount || "";
  let isAmountValid = true;

  if (existingTx && bankAmountRaw) {
    const bankAmount = Number(bankAmountRaw);
    const expectedAmount = Number(existingTx.amount);
    if (!isNaN(bankAmount) && Math.abs(bankAmount - expectedAmount) > 0.01) {
      console.error(
        `[payment/callback] KRİTİK GÜVENLİK ALARMI: Tutar manipülasyonu tespit edildi! Banka: ${bankAmount}, DB: ${expectedAmount}`
      );
      isAmountValid = false;
    }
  }

  // İşlemin başarılı kabul edilmesi için tüm güvenlik koşulları sağlanmalı
  const isPaymentSuccess = isHashValid && isMdStatusSuccess && isResponseApproved && isAmountValid;

  // Sipariş ID'sinden (usr_{userId}_{timestamp}) kullanıcı id'sini çıkar veya DB'den bul
  let userId: string | null = existingTx?.user_id || null;
  if (!userId) {
    const match = oid.match(/^usr_([a-f0-9-]{36})_/);
    if (match) {
      userId = match[1];
    }
  }

  // 5. İŞLEM BAŞARILI İSE (SUCCESS / PAID)
  if (isPaymentSuccess) {
    console.log(`[payment/callback] Ödeme başarıyla onaylandı: OID=${oid}, TransId=${transId}`);

    // payment_transactions tablosunda kaydı 'completed' olarak güncelle
    if (oid) {
      const { error: txUpdateError } = await admin
        .from("payment_transactions")
        .update({
          status: "completed",
          pos_transaction_id: transId || null,
          pos_response: rawParams,
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_order_id", oid);

      if (txUpdateError) {
        console.error("[payment/callback] payment_transactions güncelleme hatası:", txUpdateError.message);
      }
    }

    // Profil durumunu 'accepted' (Onaylandı / Ödendi) olarak güncelle
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

    // Kullanıcıyı Başarılı Sayfasına Yönlendir
    const successUrl = `/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`;
    return redirectTo(successUrl, request);
  }

  // 6. İŞLEM BAŞARISIZ İSE (FAILED)
  let securityReason = errMsg;
  if (!isHashValid) {
    securityReason = "Banka imza doğrulaması başarısız oldu (Güvenlik Uyarısı).";
  } else if (!isAmountValid) {
    securityReason = "Ödeme tutarı sistem kayıtlarıyla uyuşmuyor.";
  } else if (!isMdStatusSuccess) {
    securityReason = `3D Secure doğrulaması tamamlanamadı (mdStatus: ${mdStatus || "bilinmiyor"}).`;
  }

  console.warn(`[payment/callback] Ödeme reddedildi veya başarısız: OID=${oid}, Neden=${securityReason}`);

  if (oid) {
    const { error: txFailError } = await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        pos_transaction_id: transId || null,
        pos_response: rawParams,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_order_id", oid);

    if (txFailError) {
      console.error("[payment/callback] payment_transactions fail güncelleme hatası:", txFailError.message);
    }
  }

  // Kullanıcıyı Hata Sayfasına Yönlendir
  const failUrl = `/odeme/hata?oid=${encodeURIComponent(oid)}&error=${encodeURIComponent(securityReason || "Banka işlemi onaylamadı.")}`;
  return redirectTo(failUrl, request);
}

/**
 * GET: Bankanın bazı kontrolleri veya test istekleri için
 */
export async function GET(request: NextRequest) {
  return new Response("İş Bankası Sanal POS Callback Endpoint Aktiftir.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Güvenli ve cross-origin uyumlu HTTP 303 (See Other) Yönlendirmesi
 */
function redirectTo(path: string, request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const siteUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://asamble2440.com";
  const url = new URL(path, siteUrl);

  // 303 See Other: POST isteğini tarayıcı tarafında otomatik GET isteğine çevirir
  return NextResponse.redirect(url, 303);
}
