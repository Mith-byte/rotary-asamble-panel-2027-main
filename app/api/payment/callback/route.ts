import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * İş Bankası Klasik Nestpay (Asseco) est3Dgate & fim/api Callback Rotası
 *
 * Mimari:
 * 1. Bankadan dönen parametreler ve HASHPARAMS okunur.
 * 2. storeKey kullanılarak SHA-512 imza (HASH) doğrulaması yapılır.
 * 3. '3D Pay' modeli ise (Response === 'Approved') doğrudan provizyon alınmıştır; onaylanır.
 * 4. '3D Model' (sadece doğrulama) ise (mdStatus === '1'|'2'|'3'|'4'), arka planda
 *    https://sanalpos.isbank.com.tr/fim/api adresine XML Auth isteği atılarak tahsilat tamamlanır.
 */

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

/**
 * Nestpay Dinamik Callback Hash Doğrulama (ver2 / ver3)
 */
function verifyNestpayCallbackHash(
  rawParams: Record<string, string>,
  storeKey: string
): { valid: boolean; reason?: string } {
  const incomingHash = rawParams.HASH || rawParams.hash || "";
  const hashParams = rawParams.HASHPARAMS || rawParams.hashparams || "";

  if (!incomingHash) {
    return { valid: false, reason: "Callback yanıtında HASH değeri bulunamadı." };
  }

  if (!hashParams) {
    return { valid: false, reason: "Callback yanıtında HASHPARAMS değeri bulunamadı." };
  }

  // HASHPARAMS içindeki alan adlarını iki nokta üst üste (:) ile ayır
  const paramList = hashParams.split(":");
  let hashVal = "";

  for (const param of paramList) {
    if (!param) continue;
    // Parametre değerini al (küçük/büyük harf toleranslı)
    const val = rawParams[param] !== undefined ? rawParams[param] : (rawParams[param.toLowerCase()] ?? "");
    hashVal += val;
  }

  // Sona gizli storeKey ekle
  hashVal += storeKey;

  // SHA-512 Base64
  const calculatedHashSha512 = crypto
    .createHash("sha512")
    .update(hashVal, "utf-8")
    .digest("base64");

  // SHA-1 Base64 (Eski Nestpay terminalleri için fallback)
  const calculatedHashSha1 = crypto
    .createHash("sha1")
    .update(hashVal, "utf-8")
    .digest("base64");

  const isValid =
    calculatedHashSha512 === incomingHash ||
    calculatedHashSha1 === incomingHash;

  return {
    valid: isValid,
    reason: isValid ? undefined : `Hash uyuşmazlığı: Beklenen SHA-512 (${calculatedHashSha512}) veya SHA-1 (${calculatedHashSha1}), Gelen: (${incomingHash})`,
  };
}

async function handleCallback(request: NextRequest) {
  console.log("BANKADAN POST GELDİ - handleCallback", {
    url: request.url,
    method: request.method,
    contentType: request.headers.get("content-type"),
  });

  // 1. RATE LIMITING KORUMASI
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  const rateLimit = checkRateLimit(`payment_callback_${clientIp}`, 40, 60_000);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://asamble2440.com";

  const isWebhook = isWebhookRequest(request);

  if (!rateLimit.allowed) {
    console.warn(`[payment/callback] Rate limit aşıldı! IP: ${clientIp}`);
    return isWebhook
      ? NextResponse.json({ error: "Too many requests" }, { status: 429 })
      : redirectTo("/odeme/hata?error=Cok_fazla_istek_Lutfen_bekleyin", siteUrl);
  }

  // 2. GELEN VERİYİ AYIKLA (FormData, JSON veya Query Params)
  const rawData: Record<string, string> = {};

  const contentType = request.headers.get("content-type") || "";
  if (
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
  } else if (contentType.includes("application/json")) {
    try {
      const jsonData = await request.json();
      Object.entries(jsonData).forEach(([k, v]) => {
        rawData[k] = String(v ?? "");
      });
    } catch (e) {
      console.warn("[payment/callback] JSON parse hatası:", e);
    }
  }

  // URL query parametrelerini de harmanla
  request.nextUrl.searchParams.forEach((value, key) => {
    if (rawData[key] === undefined) {
      rawData[key] = value;
    }
  });

  console.log("[payment/callback] Nestpay gelen callback verisi:", {
    oid: rawData.oid || rawData.ReturnOid || rawData.order_number,
    Response: rawData.Response,
    ProcReturnCode: rawData.ProcReturnCode,
    mdStatus: rawData.mdStatus,
    TransId: rawData.TransId,
    amount: rawData.amount,
  });

  // 3. TEMEL ALANLARI HARİTALAMA (Mapping)
  const oid = (
    rawData.oid ||
    rawData.ReturnOid ||
    rawData.order_number ||
    rawData.orderNumber ||
    rawData.orderId ||
    rawData.merchantOrderId ||
    ""
  ).trim();

  const response = (rawData.Response || "").trim();
  const procReturnCode = (rawData.ProcReturnCode || "").trim();
  const mdStatus = (rawData.mdStatus || "").trim();
  const transId = (rawData.TransId || rawData.transId || rawData.transactionId || "").trim();
  const authCode = (rawData.AuthCode || "").trim();
  const errMsg = (
    rawData.ErrMsg ||
    rawData.mdErrorMsg ||
    rawData.ErrorMessage ||
    rawData.errorMessage ||
    rawData.error ||
    ""
  ).trim();

  const amount = (rawData.amount || "").trim();
  const md = (rawData.md || "").trim();
  const cavv = (rawData.cavv || "").trim();
  const eci = (rawData.eci || "").trim();
  const xid = (rawData.xid || "").trim();

  const storeKey = (process.env.ISBANK_STORE_KEY || "EgeKonngre55*").trim();
  const clientId = (
    process.env.ISBANK_TERMINAL_ID ||
    process.env.ISBANK_CLIENT_ID ||
    rawData.clientid ||
    "700669788069"
  ).trim();

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
  if (existingTx && (existingTx.status === "completed" || existingTx.status === "paid")) {
    console.log(`[payment/callback] Mükerrer işlem (Idempotent): OID ${oid} zaten tamamlanmış.`);
    return isWebhook
      ? NextResponse.json({ status: "OK", alreadyProcessed: true, orderId: oid })
      : redirectTo(`/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`, siteUrl);
  }

  // 5. NESTPAY CALLBACK HASH İMZA DOĞRULAMASI
  // Bankadan HASHPARAMS geldiyse imza doğrulaması yap
  if (rawData.HASHPARAMS || rawData.hashparams) {
    const hashCheck = verifyNestpayCallbackHash(rawData, storeKey);
    if (!hashCheck.valid) {
      console.error("[payment/callback] Güvenlik uyarısı: Hash doğrulaması başarısız!", hashCheck.reason);
      await markTransactionFailed(admin, oid, rawData, "Güvenlik imzası doğrulanmadı (Hash Mismatch)");
      return handleFailure(
        oid,
        "Güvenlik imzası doğrulanamadı. Sahtecilik şüphesi nedeniyle işlem durduruldu.",
        isWebhook,
        siteUrl
      );
    }
    console.log("[payment/callback] Nestpay callback hash doğrulaması başarılı.");
  }

  // Kullanıcı ID tespiti
  let userId: string | null = existingTx?.user_id || null;
  if (!userId && oid) {
    const match = oid.match(/^usr_([a-f0-9-]{36})_/);
    if (match) {
      userId = match[1];
    }
  }

  // 6. 3D SECURE DOĞRULAMA KONTROLÜ
  // mdStatus: 1 (Tam Doğrulama), 2-3-4 (Half/Accepted 3D). 0, 5, 6, 7, 8 başarısızdır.
  const is3dAuthenticated = ["1", "2", "3", "4"].includes(mdStatus);

  if (mdStatus && !is3dAuthenticated) {
    const failReason = errMsg || `3D Secure doğrulaması başarısız oldu (mdStatus: ${mdStatus}).`;
    console.warn(`[payment/callback] 3D doğrulama hatası: OID=${oid}, Neden=${failReason}`);
    await markTransactionFailed(admin, oid, rawData, failReason);
    return handleFailure(oid, failReason, isWebhook, siteUrl);
  }

  // 7. '3D PAY' MODELİ KONTROLÜ (Doğrudan est3Dgate üzerinden provizyon alındıysa)
  const is3dPayApproved = response === "Approved" && (procReturnCode === "00" || !procReturnCode);

  if (is3dPayApproved) {
    console.log(`[payment/callback] '3D Pay' doğrudan onaylandı: OID=${oid}, TransId=${transId}`);
    await markTransactionCompleted(admin, oid, userId, transId, authCode, rawData);

    if (isWebhook) {
      return NextResponse.json({ status: "OK", orderId: oid, message: "Payment approved (3D Pay)" });
    }
    return redirectTo(`/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(transId)}`, siteUrl);
  }

  // 8. '3D MODEL' BAĞLANTISI (fim/api üzerinden Auth/PreAuth tamamlama)
  // Eğer 3D doğrulaması başarılıysa ancak Response henüz 'Approved' değilse, fim/api servisine satış (Auth) isteği gönderilir.
  if (is3dAuthenticated && md) {
    console.log(`[payment/callback] '3D Model' algılandı. fim/api üzerinden tahsilat tamamlanıyor: OID=${oid}`);

    const apiUrl = (process.env.ISBANK_API_URL || "https://sanalpos.isbank.com.tr/fim/api").trim();
    const apiUser = (
      process.env.ISBANK_API_USER ||
      process.env.ISBANK_TERMINAL_ID ||
      clientId
    ).trim();
    const apiPassword = (
      process.env.ISBANK_API_PASSWORD ||
      storeKey
    ).trim();

    const authXml = `<?xml version="1.0" encoding="utf-8"?>
<CC5Request>
  <Name>${escapeXml(apiUser)}</Name>
  <Password>${escapeXml(apiPassword)}</Password>
  <ClientId>${escapeXml(clientId)}</ClientId>
  <Type>Auth</Type>
  <OrderId>${escapeXml(oid)}</OrderId>
  <Total>${escapeXml(amount || (existingTx?.amount ? existingTx.amount.toFixed(2) : ""))}</Total>
  <Currency>978</Currency>
  <Number>${escapeXml(md)}</Number>
  <PayerAuthenticationCode>${escapeXml(cavv)}</PayerAuthenticationCode>
  <PayerSecurityLevel>${escapeXml(eci)}</PayerSecurityLevel>
  <PayerTxnId>${escapeXml(xid)}</PayerTxnId>
  <IslemTipi>Auth</IslemTipi>
</CC5Request>`;

    try {
      const apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body: `DATA=${encodeURIComponent(authXml)}`,
      });

      const resText = await apiRes.text();
      console.log("[payment/callback] fim/api Auth Yanıtı:", resText);

      const apiResponse = extractXmlTag(resText, "Response");
      const apiProcReturnCode = extractXmlTag(resText, "ProcReturnCode");
      const apiTransId = extractXmlTag(resText, "TransId") || transId;
      const apiAuthCode = extractXmlTag(resText, "AuthCode") || authCode;
      const apiErrMsg = extractXmlTag(resText, "ErrMsg") || extractXmlTag(resText, "Extra:HOSTMSG") || "Banka provizyonu onaylamadı.";

      if (apiResponse === "Approved" || apiProcReturnCode === "00") {
        console.log(`[payment/callback] fim/api Auth başarılı! OID=${oid}, TransId=${apiTransId}`);
        await markTransactionCompleted(admin, oid, userId, apiTransId, apiAuthCode, {
          ...rawData,
          fim_api_response: resText,
        });

        if (isWebhook) {
          return NextResponse.json({ status: "OK", orderId: oid, message: "Payment approved (fim/api Auth)" });
        }
        return redirectTo(`/odeme/basarili?oid=${encodeURIComponent(oid)}&transId=${encodeURIComponent(apiTransId)}`, siteUrl);
      } else {
        console.error(`[payment/callback] fim/api Auth başarısız: OID=${oid}, Hata=${apiErrMsg}`);
        await markTransactionFailed(admin, oid, { ...rawData, fim_api_response: resText }, apiErrMsg);
        return handleFailure(oid, apiErrMsg, isWebhook, siteUrl);
      }
    } catch (networkErr: any) {
      console.error("[payment/callback] fim/api bağlantı hatası:", networkErr);
      const netErrorMsg = "Banka provizyon sunucusuna bağlanılamadı.";
      await markTransactionFailed(admin, oid, rawData, netErrorMsg);
      return handleFailure(oid, netErrorMsg, isWebhook, siteUrl);
    }
  }

  // 9. DİĞER DURUMLAR (Başarısız İşlem)
  const generalFailReason = errMsg || `Ödeme tamamlanamadı (Banka Yanıtı: ${response || "Bilinmiyor"}).`;
  console.warn(`[payment/callback] İşlem başarısız: OID=${oid}, Neden=${generalFailReason}`);
  await markTransactionFailed(admin, oid, rawData, generalFailReason);
  return handleFailure(oid, generalFailReason, isWebhook, siteUrl);
}

async function markTransactionCompleted(
  admin: any,
  oid: string,
  userId: string | null,
  transId: string,
  authCode: string,
  posResponse: any
) {
  if (oid) {
    await admin
      .from("payment_transactions")
      .update({
        status: "completed",
        pos_transaction_id: transId || null,
        pos_response: { ...posResponse, authCode },
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_order_id", oid);
  }

  if (userId) {
    await admin
      .from("profiles")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }
}

async function markTransactionFailed(
  admin: any,
  oid: string,
  posResponse: any,
  errorMessage: string
) {
  if (oid) {
    await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        pos_response: { ...posResponse, error_detail: errorMessage },
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_order_id", oid);
  }
}

function handleFailure(
  oid: string,
  errorMessage: string,
  isWebhook: boolean,
  siteUrl: string
) {
  if (isWebhook) {
    return NextResponse.json(
      { status: "FAILED", orderId: oid, error: errorMessage },
      { status: 400 }
    );
  }
  return redirectTo(
    `/odeme/hata?oid=${encodeURIComponent(oid)}&error=${encodeURIComponent(errorMessage)}`,
    siteUrl
  );
}

function isWebhookRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/json") && !accept.includes("text/html");
}

function redirectTo(path: string, siteUrl: string) {
  const url = new URL(path, siteUrl);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  console.log("BANKADAN POST GELDİ", {
    url: request.url,
    contentType: request.headers.get("content-type"),
  });
  return handleCallback(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const allParams = Object.fromEntries(searchParams.entries());

  console.error("BANKADAN GET İLE DÖNEN HATA:", allParams);

  // Kullanıcıyı 404'te bırakmamak için ana sayfaya veya hata sayfasına yönlendir
  return NextResponse.redirect(new URL("/?hata=banka_reddi", request.url));
}
