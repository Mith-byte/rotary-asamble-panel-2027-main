import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { calculateReservationPrice } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * İş Bankası Sanal POS (Nestpay / Est3D) Ödeme Başlatma API Rotası
 *
 * 1. storetype="3d_pay_hosting" (Kart bilgileri İş Bankası ortak ödeme sayfasında alınır).
 * 2. Doğrudan text/html formatında otomatik submit olan (auto-submit) HTML formu döner.
 * 3. Amount tutarı kesinlikle 2 ondalık basamaklı nokta ile formatlanmış string olarak iletilir (örn: "810.00").
 * 4. Hem POST (form submit) hem de GET (window.location.href) isteklerini destekler.
 */
async function handlePaymentInit(request: NextRequest) {
  // 1. RATE LIMITING KORUMASI (DDoS / Brute Force Önleme)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_init_${clientIp}`, 15, 60_000);

  if (!rateLimit.allowed) {
    return new NextResponse(
      renderErrorHtml(
        "Çok Fazla İstek",
        "Kısa süre içinde çok fazla ödeme başlatma denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
        "/odemeler"
      ),
      { status: 429, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 2. KULLANICI OTURUM KONTROLÜ
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new NextResponse(
      renderErrorHtml("Oturum Bulunamadı", "Lütfen sisteme tekrar giriş yapınız.", "/giris"),
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
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
    return new NextResponse(
      renderErrorHtml("Profil Bulunamadı", "Kullanıcı profil kaydı bulunamadı.", "/"),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (profile.status === "accepted") {
    return new NextResponse(
      renderErrorHtml("İşlem Tamamlanmış", "Ödemeniz daha önce onaylanmıştır. Tekrar ödeme yapamazsınız.", "/odemeler"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const pkg = profile.packages as any;
  if (!pkg) {
    return new NextResponse(
      renderErrorHtml("Paket Seçilmedi", "Hesabınıza tanımlı bir paket bulunamadı.", "/profil-tamamla"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const pricingType = profile.pricing_type ?? "early_bird";
  const adultPrice = Number(pkg[`${pricingType}_price`]) || 0;

  // 4. FİYAT HESAPLAMA (Euro Cinsinden)
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
    return new NextResponse(
      renderErrorHtml("Tutar Belirlenemedi", "Ödenecek sepet tutarı belirlenemedi.", "/odemeler"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 5. İŞ BANKASI PARAMETRELERİ
  const clientId = (process.env.ISBANK_CLIENT_ID || process.env.ISBANK_TERMINAL_ID || "").trim();
  const terminalId = (process.env.ISBANK_TERMINAL_ID || "").trim();
  const storeKey = (process.env.ISBANK_STORE_KEY || "").trim();
  const gateUrl = (process.env.ISBANK_3D_GATE_URL || "https://sanalpos.isbank.com.tr/fim/est3Dgate").trim();
  const callbackUrl = (process.env.ISBANK_CALLBACK_URL || "https://asamble2440.com/api/payment/callback").trim();

  if (!clientId || !storeKey) {
    console.error("[payment/init] ISBANK_CLIENT_ID veya ISBANK_STORE_KEY eksik!");
    return new NextResponse(
      renderErrorHtml(
        "Sanal POS Yapılandırma Hatası",
        "İş Bankası Sanal POS parametreleri (.env) henüz tanımlanmamış. Lütfen sistem yöneticisiyle iletişime geçin.",
        "/odemeler"
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Sipariş ID: "usr_{userId}_{timestamp}"
  const merchantOid = `usr_${user.id}_${Date.now()}`;
  // Amount formatı: Kesinlikle nokta içeren iki ondalık basamaklı string (örn: "810.00")
  const formattedAmount = Number(finalAmount).toFixed(2);
  const currencyCode = "978";
  const rnd = Date.now().toString();
  const storeType = "3d_pay_hosting";

  // 6. NESTPAY SHA-512 HASH İMZASI OLUŞTURMA (ver2)
  // Format: clientId + oid + amount + okUrl + failUrl + rnd + storeKey
  const hashString = `${clientId}${merchantOid}${formattedAmount}${callbackUrl}${callbackUrl}${rnd}${storeKey}`;
  const hash = crypto.createHash("sha512").update(hashString).digest("base64");

  // 7. VERİTABANINA İŞLEM KAYDI (payment_transactions)
  const { error: txError } = await admin.from("payment_transactions").insert({
    user_id: user.id,
    amount: finalAmount,
    currency: "EUR",
    merchant_order_id: merchantOid,
    status: "pending",
  });

  if (txError) {
    console.error("[payment/init] Transaction insert warning:", txError.message);
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  // 8. DOĞRUDAN OTOMATİK SUBMIT OLAN (AUTO-SUBMIT) HTML SAYFASI
  const htmlString = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>İş Bankası 3D Secure Güvenli Ödeme</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid #e2e8f0;
      border-top-color: #0f172a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 {
      margin: 0 0 8px;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
    }
    p {
      margin: 0 0 20px;
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.5;
    }
    .amount-badge {
      display: inline-block;
      background: #f1f5f9;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 700;
      color: #0f172a;
      font-size: 1.125rem;
      margin-bottom: 24px;
    }
    button {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
    }
    button:hover {
      background: #1e293b;
    }
  </style>
</head>
<body onload="document.forms[0].submit();">
  <div class="card">
    <div class="spinner"></div>
    <h2>İş Bankası Ortak Ödeme Sayfasına Aktarılıyorsunuz</h2>
    <p>3D Secure güvenli ödeme için İş Bankası sayfasına yönlendiriliyorsunuz. Lütfen bekleyiniz...</p>
    <div class="amount-badge">€ ${formattedAmount}</div>

    <form method="POST" action="${escapeHtml(gateUrl)}">
      <input type="hidden" name="clientid" value="${escapeHtml(clientId)}" />
      <input type="hidden" name="storetype" value="3d_pay_hosting" />
      <input type="hidden" name="hash" value="${escapeHtml(hash)}" />
      <input type="hidden" name="hashAlgorithm" value="ver2" />
      <input type="hidden" name="amount" value="${escapeHtml(formattedAmount)}" />
      <input type="hidden" name="currency" value="978" />
      <input type="hidden" name="oid" value="${escapeHtml(merchantOid)}" />
      <input type="hidden" name="okUrl" value="${escapeHtml(callbackUrl)}" />
      <input type="hidden" name="failUrl" value="${escapeHtml(callbackUrl)}" />
      <input type="hidden" name="rnd" value="${escapeHtml(rnd)}" />
      <input type="hidden" name="lang" value="tr" />
      <input type="hidden" name="islemtipi" value="Auth" />
      <input type="hidden" name="taksit" value="" />
      <input type="hidden" name="BillToName" value="${escapeHtml(fullName)}" />
      <input type="hidden" name="email" value="${escapeHtml(profile.email || "")}" />
      <input type="hidden" name="tel" value="${escapeHtml(profile.phone || "")}" />
      ${terminalId ? `<input type="hidden" name="terminalid" value="${escapeHtml(terminalId)}" />` : ""}
      <noscript>
        <button type="submit">Ödeme Sayfasına Devam Et</button>
      </noscript>
    </form>
  </div>
  <script>
    document.forms[0].submit();
  </script>
</body>
</html>`;

  console.log("NESTPAY HTML FORM:", htmlString);

  return new NextResponse(htmlString, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function POST(request: NextRequest) {
  return handlePaymentInit(request);
}

export async function GET(request: NextRequest) {
  return handlePaymentInit(request);
}

function escapeHtml(str: string | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderErrorHtml(title: string, message: string, backUrl: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; margin: 0; }
    .card { background: white; padding: 32px; border-radius: 8px; max-width: 400px; text-align: center; border: 1px solid #fee2e2; }
    h2 { color: #dc2626; margin: 0 0 10px; font-size: 1.25rem; }
    p { color: #475569; margin: 0 0 20px; font-size: 0.9rem; }
    a { display: inline-block; background: #0f172a; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    <a href="${escapeHtml(backUrl)}">Geri Dön</a>
  </div>
</body>
</html>`;
}
