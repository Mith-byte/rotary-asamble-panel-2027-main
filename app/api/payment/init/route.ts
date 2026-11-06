import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { calculateReservationPrice } from "@/lib/pricing";
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
      hasRoommate: !!profile.has_roommate,
      children: childrenList,
    });

    finalAmount = calc.totalAmount;
  }

  if (!finalAmount || finalAmount <= 0) {
    return respondError("Ödenecek sepet tutarı belirlenemedi.", 400);
  }

  // 5. İŞ BANKASI NESTPAY AYARLARI
  const clientId = (
    process.env.ISBANK_TERMINAL_ID ||
    process.env.ISBANK_CLIENT_ID ||
    "700669788069"
  ).trim();

  const storeKey = (
    process.env.ISBANK_STORE_KEY ||
    "EgeKonngre55*"
  ).trim();

  const gateUrl = (
    process.env.ISBANK_3D_GATE_URL ||
    "https://sanalpos.isbank.com.tr/fim/est3Dgate"
  ).trim();

  const storetype = (
    process.env.ISBANK_STORETYPE ||
    "3d_pay_hosting"
  ).trim();

  const islemtipi = "Auth";

  const callbackUrl = (
    process.env.ISBANK_CALLBACK_URL ||
    `${siteUrl}/api/payment/callback`
  ).trim();

  // Nestpay standartlarına göre Euro para birimi: 978
  const currency = "978";

  // Nestpay formatı: kesinlikle noktalı ve iki ondalıklı format (örn: 405.00)
  const amountFormatted = Number(finalAmount).toFixed(2);

  // Benzersiz Sipariş Numarası ve Rastgele Güvenlik Değeri (rnd)
  const oid = `usr_${user.id}_${Date.now()}`;
  const rnd = Date.now().toString() + Math.random().toString().slice(2, 8);

  // 6. NESTPAY SHA-512 HASH HESAPLAMA (ver2)
  // Kural: clientId + oid + amountFormatted + okUrl + failUrl + islemtipi + storetype + rnd + storeKey
  const okUrl = callbackUrl;
  const failUrl = callbackUrl;

  const hashString =
    clientId +
    oid +
    amountFormatted +
    okUrl +
    failUrl +
    islemtipi +
    storetype +
    rnd +
    storeKey;

  console.log("---- HASH DEBUG BAŞLANGICI ----");
  console.log("1. clientId:", clientId);
  console.log("2. oid:", oid);
  console.log("3. amountFormatted:", amountFormatted);
  console.log("4. okUrl:", okUrl);
  console.log("5. failUrl:", failUrl);
  console.log("6. islemtipi:", islemtipi);
  console.log("7. storetype:", storetype);
  console.log("8. rnd:", rnd);
  console.log("9. storeKey:", storeKey);
  console.log("10. BIRLESIM (hashString):", hashString);
  console.log("---- HASH DEBUG BITISI ----");

  const hash = crypto.createHash("sha512").update(hashString, "utf-8").digest("base64");

  console.log("[payment/init] Nestpay est3Dgate Hash üretildi:", {
    gateUrl,
    clientId,
    oid,
    amount: amountFormatted,
    currency,
    storetype,
    rnd,
  });

  // 7. VERİTABANINA İŞLEM KAYDI (pending)
  const { error: txError } = await admin.from("payment_transactions").insert({
    user_id: user.id,
    amount: finalAmount,
    currency: "EUR",
    merchant_order_id: oid,
    status: "pending",
  });

  if (txError) {
    console.error("[payment/init] Transaction insert uyarısı:", txError.message);
  }

  // 8. NESTPAY EST3DGATE FORM PARAMETRELERİ
  const formData: Record<string, string> = {
    clientid: clientId,
    amount: amountFormatted,
    oid: oid,
    okUrl: okUrl,
    failUrl: failUrl,
    rnd: rnd,
    hash: hash,
    hashAlgorithm: "ver2",
    storetype: storetype,
    islemtipi: islemtipi,
    currency: currency,
    lang: "tr",
    refreshtime: "0",
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
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body onload="document.getElementById('nestpayForm').submit();">
  <div class="card">
    <div class="spinner"></div>
    <h2 style="margin:0 0 0.5rem;font-size:1.125rem;">İş Bankası 3D Secure</h2>
    <p style="margin:0 0 1.5rem;font-size:0.875rem;color:#6b7280;">Güvenli ödeme sayfasına aktarılıyorsunuz, lütfen bekleyin...</p>
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

  // 9. YANIT: JSON İSTEMCİ İÇİN FORMDATA & HTMLCONTENT, STANDART ÇAĞRI İÇİN TEXT/HTML
  if (isJsonRequest) {
    return NextResponse.json({
      success: true,
      gatewayUrl: gateUrl,
      formData: formData,
      htmlContent: htmlContent,
      merchantOrderId: oid,
      amount: Number(finalAmount.toFixed(2)),
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
