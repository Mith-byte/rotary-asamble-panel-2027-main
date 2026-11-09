import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { calculateReservationPrice, formatEuro, isFamilyPackage } from "@/lib/pricing";
import { getEuroExchangeRate, convertEurToTry, formatTry } from "@/lib/exchange-rate";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * İş Bankası Klasik Nestpay (Asseco) est3Dgate Ödeme Başlatma Rotası
 *
 * 1. Euro (978) bazlı tutar doğrulaması yapılır.
 * 2. clientId, oid, amount, okUrl, failUrl, rnd ve storeKey kullanılarak SHA-512 hash üretilir.
 * 3. https://sanalpos.isbank.com.tr/fim/est3Dgate adresine auto-submit olacak HTML form veya JSON döner.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeVer3(val: string): string {
  return (val ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

async function handlePaymentInit(request: NextRequest) {
  const isJsonRequest =
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("content-type")?.includes("application/json") ||
    request.method === "POST";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://asamble2440.com";

  function respondError(
    errorMessage: string,
    statusCode: number = 400,
    redirectUrlPath: string = "/odeme/hata"
  ) {
    if (isJsonRequest) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }
    const targetUrl = new URL(
      `${redirectUrlPath}?error=${encodeURIComponent(errorMessage)}`,
      siteUrl
    );
    return NextResponse.redirect(targetUrl, 303);
  }

  // 1. RATE LIMITING KORUMASI
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_init_${clientIp}`, 15, 60_000);

  if (!rateLimit.allowed) {
    return respondError(
      "Kısa süre içinde çok fazla deneme yapıldı. Lütfen 1 dakika bekleyin.",
      429
    );
  }

  // 2. KULLANICI OTURUM KONTROLÜ
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isJsonRequest) {
      return NextResponse.json(
        { success: false, error: "Oturum açmanız gerekiyor.", redirectUrl: "/giris" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/giris", siteUrl);
    return NextResponse.redirect(loginUrl, 303);
  }

  const admin = createAdminClient();

  // 3. KULLANICI PROFİLİ, ODA VE PAKET BİLGİLERİ
  const { data: profile, error: profError } = await admin
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      pricing_type,
      total_amount,
      has_roommate,
      room_id,
      packages!package_id (
        id,
        name,
        capacity,
        early_bird_price,
        round_1_price,
        round_2_price
      )
    `)
    .eq("id", user.id)
    .single();

  if (profError || !profile) {
    return respondError("Profil kaydınız bulunamadı.", 404);
  }

  if (profile.status === "accepted") {
    if (isJsonRequest) {
      return NextResponse.json(
        { success: false, error: "Ödemeniz zaten onaylanmış durumdadır.", redirectUrl: "/odeme/basarili" },
        { status: 400 }
      );
    }
    const successUrl = new URL(
      "/odeme/basarili?info=" + encodeURIComponent("Ödemeniz zaten onaylanmış durumdadır."),
      siteUrl
    );
    return NextResponse.redirect(successUrl, 303);
  }

  const pkg = profile.packages as any;
  if (!pkg) {
    return respondError("Hesabınıza tanımlı paket bulunamadı.", 404);
  }

  const pricingType = profile.pricing_type ?? "early_bird";
  const adultPrice = Number(pkg[`${pricingType}_price`]) || 0;

  // 4. GÜVENLİ FİYAT HESAPLAMA (Euro Cinsinden)
  let finalAmount = profile.total_amount ? Number(profile.total_amount) : 0;

  if (!finalAmount || finalAmount <= 0) {
    let childrenList: Array<{ birthDate: string }> = [];

    if (profile.room_id) {
      const { data: guests } = await admin
        .from("room_guests")
        .select("guest_type, birth_date")
        .eq("room_id", profile.room_id);

      if (guests) {
        childrenList = guests
          .filter((g) => g.guest_type === "child" && g.birth_date)
          .map((g) => ({ birthDate: g.birth_date! }));
      }
    }

    const calc = calculateReservationPrice({
      adultPrice,
      capacity: pkg.capacity ?? 1,
      packageId: pkg.id,
      isFamily: isFamilyPackage(pkg),
      hasRoommate: !!profile.has_roommate,
      children: childrenList,
    });

    finalAmount = calc.totalAmount;
  }

  if (!finalAmount || finalAmount <= 0) {
    return respondError("Ödenecek sepet tutarı belirlenemedi.", 400);
  }

  // 5. GÜNCEL DÖVİZ KURU (TCMB / Fallback) VE TL DÖNÜŞÜMÜ
  const finalAmountEur = Number(finalAmount);
  const rateInfo = await getEuroExchangeRate();
  const eurRate = rateInfo.rate;
  const rateSource = rateInfo.source;

  const { amountTry, amountFormatted } = convertEurToTry(finalAmountEur, eurRate);

  console.log(`[payment/init] Kur Dönüşümü: ${finalAmountEur} EUR * ${eurRate} (${rateSource}) = ${amountFormatted} TRY`);

  // 6. İŞ BANKASI NESTPAY AYARLARI
  const clientId = (
    process.env.ISBANK_CLIENT_ID ||
    "700669788069"
  ).replace(/^["']|["']$/g, "").trim();

  const storeKey = (
    process.env.ISBANK_STORE_KEY ||
    "EgeKonngre55*"
  ).replace(/^["']|["']$/g, "").trim();

  const gateUrl = (
    process.env.ISBANK_3D_GATE_URL ||
    "https://sanalpos.isbank.com.tr/fim/est3Dgate"
  ).replace(/^["']|["']$/g, "").trim();

  const storetype = (
    process.env.ISBANK_STORETYPE ||
    "3d_pay_hosting"
  ).replace(/^["']|["']$/g, "").trim();

  const islemtipi = "Auth";
  const lang = "tr";

  const refreshtime = (
    process.env.ISBANK_REFRESHTIME ||
    "5"
  ).replace(/^["']|["']$/g, "").trim();

  const callbackUrl = (
    process.env.ISBANK_CALLBACK_URL ||
    `${siteUrl}/api/payment/callback`
  ).replace(/^["']|["']$/g, "").trim();

  // Nestpay Türk Lirası ISO sayısal kodu: 949
  const currency = (
    process.env.ISBANK_CURRENCY ||
    "949"
  ).replace(/^["']|["']$/g, "").trim();

  // Benzersiz Sipariş Numarası ve Rastgele Güvenlik Değeri (rnd)
  const oid = `usr_${user.id}_${Date.now()}`;
  const rnd = Date.now().toString() + Math.random().toString().slice(2, 8);

  const okUrl = callbackUrl;
  const failUrl = callbackUrl;

  // 7. NESTPAY SHA-512 HASH HESAPLAMA (ver3 Standardı - TL Tutarı Üzerinden)
  // Form parametreleri haritası (terminalid gönderilmez, sadece clientid kullanılır)
  const hashParamsMap: Record<string, string> = {
    clientid: clientId,
    storetype: storetype,
    hashAlgorithm: "ver3",
    islemtipi: islemtipi,
    amount: amountFormatted,
    currency: currency,
    oid: oid,
    okUrl: okUrl,
    failUrl: failUrl,
    lang: lang,
    rnd: rnd,
    taksit: "",
    refreshtime: refreshtime,
  };

  // ver3 Kuralı: Anahtarları küçük/büyük harf duyarsız (case-insensitive) alfabetik sıraya diz
  const sortedKeys = Object.keys(hashParamsMap).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  // Değerleri escape et ve aralarına | (pipe) koyarak birleştir, sonuna |storeKey ekle
  let hashString = "";
  for (const key of sortedKeys) {
    hashString += `${escapeVer3(hashParamsMap[key])}|`;
  }
  hashString += escapeVer3(storeKey);

  // SHA-512 Base64 digest
  const hash = crypto.createHash("sha512").update(hashString, "utf-8").digest("base64");

  console.log("---- HASH DEBUG (INIT ver3 - TRY) BAŞLANGICI ----");
  console.log("1. Orijinal EUR Tutarı:", finalAmountEur, "EUR");
  console.log("2. Uygulanan EUR/TRY Kuru:", eurRate, `(Kaynak: ${rateSource})`);
  console.log("3. Bankaya Gönderilen TL Tutarı (amount):", amountFormatted, "TRY (currency: 949)");
  console.log("4. Sıralı Anahtarlar:", sortedKeys.join(", "));
  sortedKeys.forEach((key, index) => {
    console.log(`   ${index + 1}. ${key}:`, hashParamsMap[key]);
  });
  console.log("5. storeKey (Maskeli):", `${storeKey.slice(0, 3)}***${storeKey.slice(-2)} (Uzunluk: ${storeKey.length})`);
  console.log("6. BIRLESIM (hashString):", hashString.replace(storeKey, "***STOREKEY***"));
  console.log("7. Üretilen HASH (SHA-512 Base64):", hash);
  console.log("---- HASH DEBUG (INIT ver3 - TRY) BITISI ----");

  console.log("[payment/init] Nestpay est3Dgate Hash üretildi (ver3):", {
    gateUrl,
    clientId,
    oid,
    amountEur: finalAmountEur,
    amountTry: amountTry,
    amountFormatted,
    currency,
    storetype,
    rate: eurRate,
    rateSource,
  });

  // 8. VERİTABANINA İŞLEM KAYDI (pending - EUR, Kur ve TRY Bilgileriyle)
  const txPayload = {
    user_id: user.id,
    amount: amountTry,
    currency: "TRY",
    merchant_order_id: oid,
    status: "pending" as const,
    pos_response: {
      original_amount: finalAmountEur,
      original_currency: "EUR",
      exchange_rate: eurRate,
      rate_source: rateSource,
      rate_updated_at: rateInfo.lastUpdated,
      try_amount: amountTry,
      note: "EUR to TRY conversion via TCMB / Fallback",
    },
  };

  // Kolonlar varsa doğrudan kolonlara da yazmayı dener, yoksa pos_response üzerinden veriyi eksiksiz saklar
  let { error: txError } = await admin.from("payment_transactions").insert({
    ...txPayload,
    original_amount: finalAmountEur,
    original_currency: "EUR",
    exchange_rate: eurRate,
  });

  if (txError && txError.message?.includes("column")) {
    console.warn("[payment/init] Ek kolonlar bulunamadı, pos_response üzerinden kaydediliyor...");
    const retry = await admin.from("payment_transactions").insert(txPayload);
    txError = retry.error;
  }

  if (txError) {
    console.error("[payment/init] Transaction insert uyarısı:", txError.message);
  }

  // 9. NESTPAY EST3DGATE FORM PARAMETRELERİ (ver3)
  const formData: Record<string, string> = {
    ...hashParamsMap,
    hash: hash,
  };

  const inputsHtml = Object.entries(formData)
    .map(([k, v]) => `      <input type="hidden" name="${k}" value="${escapeHtml(v)}" />`)
    .join("\n");

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>İş Bankası Sanal POS - 3D Secure Yönlendirmesi</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f9fafb;
      color: #111827;
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 440px;
      width: 90%;
    }
    .spinner {
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.25rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body onload="document.getElementById('nestpayForm').submit();">
  <div class="card">
    <div class="spinner"></div>
    <h2 style="margin:0 0 0.5rem;font-size:1.125rem;">İş Bankası 3D Secure</h2>
    <p style="margin:0 0 0.25rem;font-size:0.95rem;font-weight:600;color:#111827;">
      ${finalAmountEur.toFixed(2)} € (Ödenecek: ${amountFormatted} ₺)
    </p>
    <p style="margin:0 0 1.25rem;font-size:0.8rem;color:#6b7280;">
      Güncel Kur: 1 € = ${eurRate.toFixed(2)} ₺ — Güvenli ödeme sayfasına aktarılıyorsunuz...
    </p>
    <form id="nestpayForm" method="POST" action="${escapeHtml(gateUrl)}">
${inputsHtml}
      <noscript>
        <button type="submit" style="padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">
          Ödeme Sayfasına Devam Et
        </button>
      </noscript>
    </form>
  </div>
  <script>
    (function() {
      try {
        document.getElementById('nestpayForm').submit();
      } catch(e) {
        console.error("Auto-submit hatası:", e);
      }
    })();
  </script>
</body>
</html>`;

  // 10. YANIT: JSON İSTEMCİ İÇİN FORMDATA & HTMLCONTENT, STANDART ÇAĞRI İÇİN TEXT/HTML
  if (isJsonRequest) {
    return NextResponse.json({
      success: true,
      gatewayUrl: gateUrl,
      formData: formData,
      htmlContent: htmlContent,
      merchantOrderId: oid,
      amount: amountTry,
      amountEur: finalAmountEur,
      amountTry: amountTry,
      amountFormatted: amountFormatted,
      exchangeRate: eurRate,
      rateSource: rateSource,
      currency: "TRY",
    });
  }

  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST(request: NextRequest) {
  return handlePaymentInit(request);
}

export async function GET(request: NextRequest) {
  return handlePaymentInit(request);
}
