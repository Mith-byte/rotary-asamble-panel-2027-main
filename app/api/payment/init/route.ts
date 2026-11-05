import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { calculateReservationPrice } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * İş Bankası "İşPOS API" (virtual-pos/v1/3dPayment) 2 Aşamalı Yetkilendirme & Ödeme Rotası
 *
 * 1. Aşama (JWT Token):
 *    https://api.test.isbank.com.tr/api/sandbox-isbank/v1/jwt/ adresine
 *    X-isbank-Client-Id ve X-isbank-Client-Secret başlıklarıyla GET isteği atılarak Bearer Token alınır.
 *
 * 2. Aşama (İşPOS 3D Payment):
 *    Alınan Bearer token "Authorization: Bearer <token>" başlığına eklenerek
 *    https://api.test.isbank.com.tr/api/sandbox-isbank/virtual-pos/v1/3dPayment adresine
 *    order_number, amount (kuruş), currency (978), merchant_number, return_url verileriyle POST isteği gönderilir.
 *
 * 3. Aşama (Yönlendirme):
 *    Dönen 3D ödeme linki (paymentUrl / threeDUrl / htmlContent) ile kullanıcı güvenli banka ekranına aktarılır.
 */
async function handlePaymentInit(request: NextRequest) {
  // JSON isteği kontrolü (Fetch istemcisi veya Accept: application/json)
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
      hasRoommate: !!profile.has_roommate,
      children: childrenList,
    });

    finalAmount = calc.totalAmount;
  }

  if (!finalAmount || finalAmount <= 0) {
    return respondError("Ödenecek sepet tutarı belirlenemedi.", 400);
  }

  // 5. İŞ BANKASI KİMLİK BİLGİLERİ VE UÇ NOKTALARI
  const clientId = (process.env.ISBANK_CLIENT_ID || "").trim();
  const clientSecret = (process.env.ISBANK_CLIENT_SECRET || "").trim();
  const terminalId = (process.env.ISBANK_TERMINAL_ID || "").trim();

  // 1. Aşama: JWT Token Endpoint (İş Bankası Dokümantasyonu)
  const jwtUrl = (
    process.env.ISBANK_JWT_URL ||
    "https://api.test.isbank.com.tr/api/sandbox-isbank/v1/jwt/"
  ).trim();

  // 2. Aşama: İşPOS Virtual POS 3D Payment Endpoint
  const isposUrl = (
    process.env.ISBANK_ISPOS_URL ||
    process.env.ISBANK_API_URL ||
    "https://api.test.isbank.com.tr/api/sandbox-isbank/virtual-pos/v1/3dPayment"
  ).trim();

  const callbackUrl = (process.env.ISBANK_CALLBACK_URL || `${siteUrl}/api/payment/callback`).trim();

  if (!clientId || !clientSecret) {
    console.error("[payment/init] ISBANK_CLIENT_ID veya ISBANK_CLIENT_SECRET eksik!");
    return respondError("İş Bankası Sanal POS ayarları (.env) tanımlanmamış.", 500);
  }

  // 6. AŞAMA 1: JWT TOKEN ALMA (X-isbank-Client-Id & X-isbank-Client-Secret)
  let bearerToken = (process.env.ISBANK_BEARER_TOKEN || "").trim();

  if (!bearerToken) {
    const jwtResult = await fetchIsbankJwtToken(jwtUrl, clientId, clientSecret);
    if (jwtResult.token) {
      bearerToken = jwtResult.token;
      console.log("[payment/init] 1. Aşama Tamamlandı: JWT Bearer Token temin edildi.");
    } else {
      console.error("[payment/init] 1. Aşama Hatası: JWT token alınamadı:", jwtResult.error);
      return respondError(
        "İş Bankası yetkilendirme (JWT) token'ı temin edilemedi: " + (jwtResult.error || ""),
        502
      );
    }
  }

  // Benzersiz Sipariş Kodu
  const merchantOid = `usr_${user.id}_${Date.now()}`;
  const formattedAmount = Number(finalAmount.toFixed(2));
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  // 7. VERİTABANINA İŞLEM KAYDI (pending)
  const { error: txError } = await admin.from("payment_transactions").insert({
    user_id: user.id,
    amount: finalAmount,
    currency: "EUR",
    merchant_order_id: merchantOid,
    status: "pending",
  });

  if (txError) {
    console.error("[payment/init] Transaction insert uyarısı:", txError.message);
  }

  // 8. İŞPOS 3D PAYMENT REST API İSTEK GÖVDESİ (REQUEST PAYLOAD)
  // Tutar Euro cent / kuruş formatında (kuruşsuz tam tutar kuruşlandırılarak gönderilir: örn: 500.00 € -> 50000)
  const amountInCents = Math.round(finalAmount * 100);

  const requestPayload = {
    order_number: merchantOid,
    merchant_number: terminalId || clientId,
    amount: amountInCents,
    currency: "978", // Euro (ISO 4217)
    return_url: callbackUrl,

    // Alternatif/genişletilmiş API alan uyumlulukları:
    orderId: merchantOid,
    merchantId: terminalId || clientId,
    merchantNumber: terminalId || clientId,
    currencyCode: "978",
    callbackUrl: callbackUrl,
    successUrl: callbackUrl,
    failUrl: callbackUrl,
    customer: {
      id: user.id,
      name: fullName,
      email: profile.email || "",
      phone: profile.phone || "",
    },
    buyer: {
      id: user.id,
      name: profile.first_name || "",
      surname: profile.last_name || "",
      email: profile.email || "",
      gsmNumber: profile.phone || "",
    },
    basketItems: [
      {
        id: pkg.id || "reservation",
        name: pkg.name || "Rotary Asamble 2027 Rezervasyon",
        price: formattedAmount,
        quantity: 1,
      },
    ],
  };

  // 9. AŞAMA 2: BEARER TOKEN İLE İŞPOS 3D PAYMENT İSTEĞİ (Authorization: Bearer <token>)
  const paymentHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-isbank-Client-Id": clientId,
    "X-isbank-Client-Secret": clientSecret,
    Authorization: `Bearer ${bearerToken}`,
  };

  console.log("[payment/init] 2. Aşama: İşPOS 3D Payment API isteği gönderiliyor:", {
    url: isposUrl,
    order_number: merchantOid,
    merchant_number: terminalId || clientId,
    amount: amountInCents,
    currency: "978",
  });

  let bankResponseData: any = null;
  try {
    const bankRes = await fetch(isposUrl, {
      method: "POST",
      headers: paymentHeaders,
      body: JSON.stringify(requestPayload),
    });

    const textResponse = await bankRes.text();
    try {
      bankResponseData = JSON.parse(textResponse);
    } catch {
      bankResponseData = { rawResponse: textResponse };
    }

    console.log("[payment/init] İşPOS API Yanıtı:", {
      status: bankRes.status,
      data: bankResponseData,
    });

    if (
      !bankRes.ok &&
      !bankResponseData?.paymentUrl &&
      !bankResponseData?.redirectUrl &&
      !bankResponseData?.threeDUrl &&
      !bankResponseData?.htmlContent &&
      !bankResponseData?.html
    ) {
      const errMsg =
        bankResponseData?.resultMessage ||
        bankResponseData?.message ||
        bankResponseData?.error_description ||
        `Banka servisi HTTP ${bankRes.status} hatası döndü.`;

      console.error("[payment/init] İşPOS ödeme isteği başarısız oldu:", errMsg);

      await admin
        .from("payment_transactions")
        .update({
          status: "failed",
          pos_response: bankResponseData,
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_order_id", merchantOid);

      return respondError(errMsg, 502);
    }
  } catch (networkErr: any) {
    console.error("[payment/init] İş Bankası ödeme servisi bağlantı hatası:", networkErr);

    await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        pos_response: { error: networkErr?.message || "Network Error" },
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_order_id", merchantOid);

    return respondError(
      "İş Bankası ödeme sunucusuna bağlanılamadı. Lütfen tekrar deneyin.",
      502
    );
  }

  // 10. DOĞRUDAN ÖDEME BAĞLANTISINA (URL) VEYA 3D HTML İÇERİĞİNE YÖNLENDİRME
  const paymentUrl =
    bankResponseData?.paymentUrl ||
    bankResponseData?.redirectUrl ||
    bankResponseData?.threeDUrl ||
    bankResponseData?.threeDSecureUrl ||
    bankResponseData?.checkoutUrl ||
    bankResponseData?.gatewayUrl ||
    bankResponseData?.url ||
    bankResponseData?.actionUrl ||
    (bankResponseData?.token
      ? `https://ispaytest.isbank.com.tr/?jwt=${encodeURIComponent(bankResponseData.token)}`
      : null) ||
    (bankResponseData?.jwt
      ? `https://ispaytest.isbank.com.tr/?jwt=${encodeURIComponent(bankResponseData.jwt)}`
      : null) ||
    bankResponseData?.data?.paymentUrl ||
    bankResponseData?.data?.redirectUrl ||
    bankResponseData?.data?.threeDUrl ||
    bankResponseData?.data?.url;

  const htmlContent =
    bankResponseData?.htmlContent ||
    bankResponseData?.html ||
    bankResponseData?.threeDHtml ||
    bankResponseData?.data?.htmlContent ||
    bankResponseData?.data?.html;

  if (!paymentUrl && !htmlContent) {
    console.error("[payment/init] Yanıtta ödeme yönlendirme bağlantısı veya HTML içeriği bulunamadı:", bankResponseData);
    return respondError("Ödeme sayfası yönlendirme bağlantısı alınamadı.", 502);
  }

  // İşlem detayını banka yanıtıyla güncelle
  await admin
    .from("payment_transactions")
    .update({
      pos_transaction_id:
        bankResponseData?.transactionId ||
        bankResponseData?.token ||
        bankResponseData?.jwt ||
        bankResponseData?.orderId ||
        null,
      pos_response: bankResponseData,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_order_id", merchantOid);

  console.log(`[payment/init] Kullanıcı İşPOS 3D ödeme ekranına yönlendiriliyor: ${paymentUrl || "3D HTML Formu"}`);

  if (isJsonRequest) {
    return NextResponse.json({
      success: true,
      paymentUrl: paymentUrl || undefined,
      htmlContent: htmlContent || undefined,
      merchantOrderId: merchantOid,
      amount: formattedAmount,
    });
  }

  if (paymentUrl) {
    return NextResponse.redirect(paymentUrl, 303);
  }

  return new NextResponse(htmlContent, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * 1. Aşama: İş Bankası JWT Token Üretici Fonksiyonu
 * Dokümandaki Code Samples'a göre X-isbank-Client-Id ve X-isbank-Client-Secret başlıklarını kullanır.
 */
async function fetchIsbankJwtToken(
  jwtUrl: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string | null; error?: string }> {
  const headers: Record<string, string> = {
    "X-isbank-Client-Id": clientId,
    "X-isbank-Client-Secret": clientSecret,
    Accept: "application/json",
  };

  console.log("[fetchIsbankJwtToken] JWT Token isteği gönderiliyor:", {
    url: jwtUrl,
    clientIdPrefix: clientId.slice(0, 6) + "...",
  });

  try {
    // 1. Dokümandaki Code Samples standardı: GET isteği
    let res = await fetch(jwtUrl, {
      method: "GET",
      headers,
    });

    // 405 dönerse POST alternatifini dene
    if (res.status === 405) {
      res = await fetch(jwtUrl, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    }

    const text = await res.text();

    if (!res.ok) {
      return {
        token: null,
        error: `HTTP ${res.status}: ${text}`,
      };
    }

    try {
      const data = JSON.parse(text);
      const token =
        data.token ||
        data.access_token ||
        data.jwt ||
        data.data?.token ||
        data.data?.jwt ||
        data.accessToken ||
        (typeof data === "string" ? data : null);

      if (token) {
        return { token: String(token).trim() };
      }
    } catch {
      // Dönen yanıt doğrudan düz JWT metni ise (örn: eyJ...)
      if (text.startsWith("ey") || text.length > 20) {
        return { token: text.replace(/^"|"$/g, "").trim() };
      }
    }

    return { token: null, error: `Token ayrıştırılamadı. Yanıt: ${text}` };
  } catch (err: any) {
    return { token: null, error: err?.message || "Bağlantı hatası" };
  }
}

export async function POST(request: NextRequest) {
  return handlePaymentInit(request);
}

export async function GET(request: NextRequest) {
  return handlePaymentInit(request);
}
