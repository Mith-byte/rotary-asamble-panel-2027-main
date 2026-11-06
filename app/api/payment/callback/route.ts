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

function escapeVer3(val: string): string {
  return (val ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

/**
 * Nestpay Dinamik Callback Hash Doğrulama (ver3 ve ver2)
 *
 * 1. ver3 Yöntemi: Bankadan dönen tüm parametreler (hash, encoding, countdown hariç)
 *    küçük/büyük harf duyarsız (case-insensitive) alfabetik dizilir,
 *    değerleri escape edilerek aralarına | konulup sonuna |storeKey eklenir ve SHA-512 Base64 alınır.
 * 2. HASHPARAMSVAL + "|" + storeKey Yöntemi: Bankanın hazır gönderdiği HASHPARAMSVAL
 *    ile storeKey arasına | konarak SHA-512 Base64 alınır.
 * 3. HASHPARAMSVAL + storeKey (Pipesiz) ve Reconstructed HASHPARAMS yöntemleri yedek olarak denenir.
 *
 * Adaylardan herhangi biri bankanın HASH değeriyle eşleşirse imza GEÇERLİ kabul edilir.
 */
function verifyNestpayCallbackHash(
  rawParams: Record<string, string>,
  storeKey: string,
  fallbackClientId?: string
): { valid: boolean; matchedMethod?: string; reason?: string } {
  const incomingHash = (rawParams.HASH || rawParams.hash || "").trim();
  const hashParams = (rawParams.HASHPARAMS || rawParams.hashparams || "").trim();
  const hashParamsVal = (rawParams.HASHPARAMSVAL || rawParams.hashparamsval || "").trim();

  if (!incomingHash) {
    return { valid: false, reason: "Callback yanıtında HASH değeri bulunamadı." };
  }

  const candidates: Array<{ name: string; computedHash: string; plainString: string }> = [];

  // YÖNTEM 1: Nestpay ver3 Standardı (Gelen body'deki hash, encoding, countdown hariç tüm key'ler alfabetik sıralı)
  const ver3Keys = Object.keys(rawParams).filter((key) => {
    const lower = key.toLowerCase();
    return lower !== "hash" && lower !== "encoding" && lower !== "countdown";
  });

  if (ver3Keys.length > 0) {
    ver3Keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    let ver3Plain = "";
    for (const key of ver3Keys) {
      ver3Plain += `${escapeVer3(rawParams[key])}|`;
    }
    ver3Plain += escapeVer3(storeKey);
    const ver3Sha512 = crypto.createHash("sha512").update(ver3Plain, "utf-8").digest("base64");
    candidates.push({
      name: "Nestpay ver3 (Alfabetik Parametreler + Pipe + storeKey - SHA-512 Base64)",
      computedHash: ver3Sha512,
      plainString: ver3Plain,
    });
  }

  // YÖNTEM 2: Bankanın gönderdiği hazır HASHPARAMSVAL + "|" + storeKey (Nestpay Pipe Standardı)
  if (hashParamsVal) {
    const plainValWithPipe = `${hashParamsVal}|${escapeVer3(storeKey)}`;
    const sha512WithPipe = crypto.createHash("sha512").update(plainValWithPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + \"|\" + storeKey (SHA-512 Base64)",
      computedHash: sha512WithPipe,
      plainString: plainValWithPipe,
    });

    const sha1WithPipe = crypto.createHash("sha1").update(plainValWithPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + \"|\" + storeKey (SHA-1 Base64)",
      computedHash: sha1WithPipe,
      plainString: plainValWithPipe,
    });

    const sha256WithPipe = crypto.createHash("sha256").update(plainValWithPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + \"|\" + storeKey (SHA-256 Base64)",
      computedHash: sha256WithPipe,
      plainString: plainValWithPipe,
    });
  }

  // YÖNTEM 3: HASHPARAMSVAL + storeKey (Pipesiz Nestpay ver2 yöntemi)
  if (hashParamsVal) {
    const plainValNoPipe = hashParamsVal + storeKey;
    const sha512NoPipe = crypto.createHash("sha512").update(plainValNoPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + storeKey (Pipesiz SHA-512 Base64)",
      computedHash: sha512NoPipe,
      plainString: plainValNoPipe,
    });

    const sha1NoPipe = crypto.createHash("sha1").update(plainValNoPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + storeKey (Pipesiz SHA-1 Base64)",
      computedHash: sha1NoPipe,
      plainString: plainValNoPipe,
    });

    const sha256NoPipe = crypto.createHash("sha256").update(plainValNoPipe, "utf-8").digest("base64");
    candidates.push({
      name: "HASHPARAMSVAL + storeKey (Pipesiz SHA-256 Base64)",
      computedHash: sha256NoPipe,
      plainString: plainValNoPipe,
    });
  }

  // YÖNTEM 4: HASHPARAMS listesindeki alan adlarına göre tek tek birleştirme
  const paramBreakdown: Record<string, string> = {};
  if (hashParams) {
    const paramList = hashParams.split(/[:|]/).filter(Boolean);
    const valuesList: string[] = [];
    for (const param of paramList) {
      let val = rawParams[param];
      if (val === undefined) val = rawParams[param.toLowerCase()];
      if (val === undefined) val = rawParams[param.toUpperCase()];
      if (val === undefined) val = "";

      paramBreakdown[param] = val;
      valuesList.push(val);
    }

    // Pipe ile birleşim
    let plainRecWithPipe = "";
    for (const v of valuesList) {
      plainRecWithPipe += `${escapeVer3(v)}|`;
    }
    plainRecWithPipe += escapeVer3(storeKey);
    const sha512RecPipe = crypto.createHash("sha512").update(plainRecWithPipe, "utf-8").digest("base64");
    candidates.push({
      name: "Reconstructed HASHPARAMS + \"|\" + storeKey (SHA-512 Base64)",
      computedHash: sha512RecPipe,
      plainString: plainRecWithPipe,
    });

    // Pipesiz birleşim
    const plainRecNoPipe = valuesList.join("") + storeKey;
    const sha512RecNoPipe = crypto.createHash("sha512").update(plainRecNoPipe, "utf-8").digest("base64");
    candidates.push({
      name: "Reconstructed HASHPARAMS + storeKey (Pipesiz SHA-512 Base64)",
      computedHash: sha512RecNoPipe,
      plainString: plainRecNoPipe,
    });
  }

  // YÖNTEM 5: Init sırasıyla eşleştirme (Fallback)
  const clientid = rawParams.clientid || rawParams.clientId || fallbackClientId || "";
  const oid = rawParams.oid || rawParams.ReturnOid || rawParams.orderId || "";
  const amount = rawParams.amount || "";
  const okUrl = rawParams.okUrl || rawParams.okurl || "";
  const failUrl = rawParams.failUrl || rawParams.failurl || "";
  const islemtipi = rawParams.islemtipi || "Auth";
  const storetype = rawParams.storetype || "3d_pay_hosting";
  const rnd = rawParams.rnd || "";

  if (clientid && oid && amount && rnd) {
    const initOrderPipe = `${clientid}|${oid}|${amount}|${okUrl}|${failUrl}|${islemtipi}|${storetype}|${rnd}|${escapeVer3(storeKey)}`;
    const sha512InitPipe = crypto.createHash("sha512").update(initOrderPipe, "utf-8").digest("base64");
    candidates.push({
      name: "Init Sıralaması + Pipe + storeKey (SHA-512 Base64)",
      computedHash: sha512InitPipe,
      plainString: initOrderPipe,
    });

    const initOrderPlain = clientid + oid + amount + okUrl + failUrl + islemtipi + storetype + rnd + storeKey;
    const sha512Init = crypto.createHash("sha512").update(initOrderPlain, "utf-8").digest("base64");
    candidates.push({
      name: "Init Sıralaması (Pipesiz) + storeKey (SHA-512 Base64)",
      computedHash: sha512Init,
      plainString: initOrderPlain,
    });
  }

  // KONSOLA DETAYLI DEBUG KATMANI
  console.log("==================== NESTPAY CALLBACK HASH DEBUG ====================");
  console.log("Bankadan Gelen HASH:", incomingHash);
  console.log("Bankadan Gelen HASHPARAMS:", hashParams || "(YOK)");
  console.log("Bankadan Gelen HASHPARAMSVAL:", hashParamsVal || "(YOK)");
  console.log("HASHPARAMS Parametre Dökümü:", paramBreakdown);
  console.log("Kullanılan storeKey (Maskeli):", `${storeKey.slice(0, 3)}***${storeKey.slice(-2)} (Uzunluk: ${storeKey.length})`);
  console.log("Hesaplanan Adaylar:");
  candidates.forEach((c) => {
    const isMatch = c.computedHash === incomingHash || c.computedHash.toLowerCase() === incomingHash.toLowerCase();
    console.log(`  [${isMatch ? "EŞLEŞTİ OK" : "UYUŞMADI"}] ${c.name}`);
    console.log(`     Hesaplanan: ${c.computedHash}`);
    console.log(`     Ham Metin:  ${c.plainString.replace(storeKey, "***STOREKEY***")}`);
  });
  console.log("=====================================================================");

  const matched = candidates.find(
    (c) => c.computedHash === incomingHash || c.computedHash.toLowerCase() === incomingHash.toLowerCase()
  );
  if (matched) {
    return { valid: true, matchedMethod: matched.name };
  }

  return {
    valid: false,
    reason: `Bankadan gelen HASH (${incomingHash}) ile hesaplanan hiçbir aday eşleşmedi. (Denendi: ${candidates.length} farklı yöntem)`,
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

  console.log("==================== NESTPAY CALLBACK GELEN HAM VERİ ====================");
  console.log("URL:", request.url);
  console.log("Method:", request.method);
  console.log("Content-Type:", contentType);
  console.log("Tüm Parametreler (JSON):", JSON.stringify(rawData, null, 2));
  console.log("=========================================================================");

  // Vercel tek satır JSON kesilmesine karşı kritik alanların açık ve net loglanması:
  console.log("==================== NESTPAY KRİTİK ALANLAR ====================");
  console.log("Response:", rawData.Response || rawData.response || "(BOŞ)");
  console.log("ProcReturnCode:", rawData.ProcReturnCode || rawData.procreturncode || "(BOŞ)");
  console.log("mdStatus:", rawData.mdStatus || rawData.mdstatus || "(BOŞ)");
  console.log("ErrMsg:", rawData.ErrMsg || rawData.errMsg || rawData.errmsg || "(BOŞ)");
  console.log("mdErrorMsg:", rawData.mdErrorMsg || rawData.mderrormsg || "(BOŞ)");
  console.log("ErrorMessage:", rawData.ErrorMessage || rawData.errorMessage || rawData.error || "(BOŞ)");
  console.log("oid:", rawData.oid || rawData.ReturnOid || rawData.orderId || "(BOŞ)");
  console.log("TransId:", rawData.TransId || rawData.transId || rawData.transid || "(BOŞ)");
  console.log("AuthCode:", rawData.AuthCode || rawData.authCode || rawData.authcode || "(BOŞ)");
  console.log("HASH:", rawData.HASH || rawData.hash || "(BOŞ)");
  console.log("HASHPARAMS:", rawData.HASHPARAMS || rawData.hashparams || "(BOŞ)");
  console.log("HASHPARAMSVAL:", rawData.HASHPARAMSVAL || rawData.hashparamsval || "(BOŞ)");
  console.log("================================================================");

  // 3. TEMEL ALANLARI HARİTALAMA (Mapping - Büyük/küçük harf toleranslı)
  const oid = (
    rawData.oid ||
    rawData.ReturnOid ||
    rawData.returnOid ||
    rawData.order_number ||
    rawData.orderNumber ||
    rawData.orderId ||
    rawData.merchantOrderId ||
    ""
  ).trim();

  const response = (rawData.Response || rawData.response || "").trim();
  const procReturnCode = (rawData.ProcReturnCode || rawData.procreturncode || "").trim();
  const mdStatus = (rawData.mdStatus || rawData.mdstatus || "").trim();
  const transId = (rawData.TransId || rawData.transId || rawData.transid || rawData.transactionId || "").trim();
  const authCode = (rawData.AuthCode || rawData.authCode || rawData.authcode || "").trim();
  const errMsg = (
    rawData.ErrMsg ||
    rawData.errMsg ||
    rawData.errmsg ||
    rawData.mdErrorMsg ||
    rawData.mderrormsg ||
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

  const storeKey = (
    process.env.ISBANK_STORE_KEY ||
    "EgeKonngre55*"
  ).replace(/^["']|["']$/g, "").trim();

  const clientId = (
    process.env.ISBANK_CLIENT_ID ||
    rawData.clientid ||
    rawData.clientId ||
    "700669788069"
  ).replace(/^["']|["']$/g, "").trim();

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
  // Bankadan HASHPARAMS veya HASH geldiyse imza doğrulaması yap
  if (rawData.HASHPARAMS || rawData.hashparams || rawData.HASH || rawData.hash) {
    const hashCheck = verifyNestpayCallbackHash(rawData, storeKey, clientId);
    if (!hashCheck.valid) {
      console.error("[payment/callback] Güvenlik uyarısı: Hash doğrulaması başarısız!", hashCheck.reason);
      await markTransactionFailed(admin, oid, rawData, `Güvenlik imzası doğrulanmadı: ${hashCheck.reason}`);
      return handleFailure(
        oid,
        `Güvenlik imzası doğrulanamadı: ${hashCheck.reason}`,
        isWebhook,
        siteUrl
      );
    }
    console.log(`[payment/callback] Nestpay callback hash doğrulaması başarılı! (Kullanılan Yöntem: ${hashCheck.matchedMethod})`);
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
    const { data: currentTx } = await admin
      .from("payment_transactions")
      .select("pos_response")
      .eq("merchant_order_id", oid)
      .maybeSingle();

    const mergedResponse = {
      ...(currentTx?.pos_response || {}),
      bank_callback: posResponse,
      authCode,
      completed_at: new Date().toISOString(),
    };

    await admin
      .from("payment_transactions")
      .update({
        status: "completed",
        pos_transaction_id: transId || null,
        pos_response: mergedResponse,
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
    const { data: currentTx } = await admin
      .from("payment_transactions")
      .select("pos_response")
      .eq("merchant_order_id", oid)
      .maybeSingle();

    const mergedResponse = {
      ...(currentTx?.pos_response || {}),
      bank_callback: posResponse,
      error_detail: errorMessage,
      failed_at: new Date().toISOString(),
    };

    await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        pos_response: mergedResponse,
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const allParams = Object.fromEntries(searchParams.entries());

  console.error("==================== BANKADAN GET İLE DÖNEN HATA ====================");
  console.error("URL:", request.url);
  console.error("Response:", allParams.Response || allParams.response || "(BOŞ)");
  console.error("ProcReturnCode:", allParams.ProcReturnCode || allParams.procreturncode || "(BOŞ)");
  console.error("mdStatus:", allParams.mdStatus || allParams.mdstatus || "(BOŞ)");
  console.error("ErrMsg:", allParams.ErrMsg || allParams.errMsg || allParams.errmsg || "(BOŞ)");
  console.error("mdErrorMsg:", allParams.mdErrorMsg || allParams.mderrormsg || "(BOŞ)");
  console.error("ErrorMessage:", allParams.ErrorMessage || allParams.errorMessage || "(BOŞ)");
  console.error("Tüm GET Parametreleri:", allParams);
  console.error("=====================================================================");

  const response = (allParams.Response || allParams.response || "").trim();
  if (response === "Approved") {
    return handleCallback(request);
  }

  const errMsg =
    allParams.ErrMsg ||
    allParams.mdErrorMsg ||
    allParams.ErrorMessage ||
    allParams.errorMessage ||
    allParams.error ||
    "Banka işlemi onaylamadı.";
  const oid = allParams.oid || allParams.ReturnOid || "";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://asamble2440.com";

  return NextResponse.redirect(
    new URL(
      `/odeme/hata?oid=${encodeURIComponent(oid)}&error=${encodeURIComponent(errMsg)}`,
      siteUrl
    ),
    303
  );
}
