import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import crypto from "crypto";
import { calculateReservationPrice } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * İş Bankası Sanal POS (Nestpay / Est3D) Ödeme Başlatma API Rotası
 *
 * Güvenlik Katmanları:
 * - Rate Limiting: IP başına dakikada maksimum 10 istek
 * - CSRF Koruması: Origin / Referer doğrulaması
 * - Server-Side Yetkilendirme ve Tutar Doğrulaması: Tutar istemciden değil, doğrudan DB'den doğrulanır.
 */
export async function POST(request: NextRequest) {
  // 1. RATE LIMITING KORUMASI (DDoS / Brute Force Önleme)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_init_${clientIp}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return new Response(
      renderErrorHtml(
        "Çok Fazla İstek",
        "Kısa süre içinde çok fazla ödeme başlatma denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
        "/odemeler"
      ),
      { status: 429, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 2. CSRF (Cross-Site Request Forgery) KONTROLÜ
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "";
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const currentHost = host.toLowerCase();
      if (
        originHost !== currentHost &&
        !originHost.includes("asamble2440.com") &&
        !originHost.includes("localhost")
      ) {
        console.warn(`[payment/init] CSRF şüphesi: Origin (${originHost}) !== Host (${currentHost})`);
        return new Response(
          renderErrorHtml("Erişim Engellendi", "Geçersiz istek kaynağı tespit edildi.", "/odemeler"),
          { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    } catch {
      // Invalid URL
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      renderErrorHtml("Oturum Bulunamadı", "Lütfen sisteme tekrar giriş yapınız.", "/giris"),
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const admin = createAdminClient();

  // Kullanıcı profili, oda ve paket bilgilerini çek
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
    return new Response(
      renderErrorHtml("Profil Bulunamadı", "Kullanıcı profil kaydı bulunamadı.", "/"),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (profile.status === "accepted") {
    return new Response(
      renderErrorHtml("İşlem Tamamlanmış", "Ödemeniz daha önce onaylanmıştır. Tekrar ödeme yapamazsınız.", "/odemeler"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const pkg = profile.packages as any;
  if (!pkg) {
    return new Response(
      renderErrorHtml("Paket Seçilmedi", "Hesabınıza tanımlı bir paket bulunamadı.", "/profil-tamamla"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const pricingType = profile.pricing_type ?? "early_bird";
  const adultPrice = Number(pkg[`${pricingType}_price`]) || 0;

  // 1. FİYAT HESAPLAMA (Euro Cinsinden)
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
    return new Response(
      renderErrorHtml("Tutar Belirlenemedi", "Ödenecek sepet tutarı belirlenemedi.", "/odemeler"),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 2. İŞ BANKASI PARAMETRELERİ
  const clientId = (process.env.ISBANK_CLIENT_ID || process.env.ISBANK_TERMINAL_ID || "").trim();
  const storeKey = (process.env.ISBANK_STORE_KEY || "").trim();
  const gateUrl = (process.env.ISBANK_3D_GATE_URL || "https://sanalpos.isbank.com.tr/fim/est3Dgate").trim();
  const callbackUrl = (process.env.ISBANK_CALLBACK_URL || "https://asamble2440.com/api/payment/callback").trim();

  if (!clientId || !storeKey) {
    console.error("[payment/init] ISBANK_CLIENT_ID veya ISBANK_STORE_KEY eksik!");
    return new Response(
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
  const formattedAmount = finalAmount.toFixed(2); // 2 ondalık basamaklı Euro (örn: 275.00)
  const currencyCode = "978"; // Kesinlikle Euro: 978 (ISO 4217)
  const rnd = Date.now().toString();
  const storeType = "3d_pay_hosting";

  // 3. NESTPAY SHA-512 HASH İMZASI OLUŞTURMA
  // Format: clientId + oid + amount + okUrl + failUrl + rnd + storeKey
  const hashPlain = `${clientId}${merchantOid}${formattedAmount}${callbackUrl}${callbackUrl}${rnd}${storeKey}`;
  const hash = crypto.createHash("sha512").update(hashPlain, "utf-8").digest("base64");

  // 4. VERİTABANINA İŞLEM KAYDI (payment_transactions)
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

  // 5. OTOMATİK SUBMIT OLAN (AUTO-SUBMIT) HTML FORM YANITI
  const html = `<!DOCTYPE html>
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>İş Bankası Sanal POS'a Aktarılıyorsunuz</h2>
    <p>3D Secure güvenli ödeme sayfasına yönlendiriliyorsunuz. Lütfen sayfayı kapatmayınız.</p>
    <div class="amount-badge">€ ${formattedAmount}</div>

    <form id="isbank_form" action="${escapeHtml(gateUrl)}" method="POST">
      <input type="hidden" name="clientid" value="${escapeHtml(clientId)}" />
      <input type="hidden" name="storetype" value="${escapeHtml(storeType)}" />
      <input type="hidden" name="hash" value="${escapeHtml(hash)}" />
      <input type="hidden" name="hashAlgorithm" value="ver3" />
      <input type="hidden" name="amount" value="${escapeHtml(formattedAmount)}" />
      <input type="hidden" name="currency" value="${escapeHtml(currencyCode)}" />
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
      <noscript>
        <button type="submit">Ödeme Sayfasına Devam Et</button>
      </noscript>
    </form>
  </div>
  <script>
    (function() {
      var f = document.getElementById("isbank_form");
      if (f) {
        f.submit();
      }
    })();
  </script>
</body>
</html>`;

  // İsterse JSON formatı da dönebilir
  const acceptHeader = request.headers.get("accept") || "";
  if (acceptHeader.includes("application/json") && !acceptHeader.includes("text/html")) {
    return new Response(
      JSON.stringify({
        html,
        redirect_url: gateUrl,
        merchant_oid: merchantOid,
        amount: finalAmount,
        currency: currencyCode,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
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
