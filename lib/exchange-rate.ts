/**
 * TCMB Günlük Döviz Kuru Servisi & Euro - Türk Lirası Dönüştürücü
 *
 * Kaynak: https://www.tcmb.gov.tr/kurlar/today.xml
 * Özellikler:
 * 1. FIXED_EUR_RATE ortam değişkeni varsa doğrudan onu kullanır (Test veya sabit kur için).
 * 2. TCMB XML servisinden güncel EUR ForexSelling (Efektif/Döviz Satış) kurunu çeker.
 * 3. Performans ve rate-limit koruması için 15 dakikalık bellek içi önbellek (cache) uygular.
 * 4. Ağ kesintisi veya TCMB erişim hatasında güvenli yedek (fallback) kura döner.
 */

export interface ExchangeRateResult {
  rate: number;
  source: "tcmb" | "fixed_env" | "fallback";
  lastUpdated: string;
  note?: string;
}

// 15 dakikalık bellek içi önbellek (Cache TTL)
const CACHE_TTL_MS = 15 * 60 * 1000;
let cachedRate: { rate: number; timestamp: number; source: "tcmb" | "fallback" } | null = null;

// Varsayılan yedek kur (TCMB erişilemezse ve env yoksa)
const DEFAULT_FALLBACK_EUR_RATE = 38.50;

/**
 * TCMB XML verisinden EUR ForexSelling veya BanknoteSelling kurunu ayıklar.
 */
function extractEurRateFromXml(xmlText: string): number | null {
  const eurBlockMatch = xmlText.match(
    /<Currency[^>]*(?:Kod|CurrencyCode)=["']EUR["'][^>]*>([\s\S]*?)<\/Currency>/i
  );
  if (!eurBlockMatch) return null;

  const block = eurBlockMatch[1];
  const fsMatch = block.match(/<ForexSelling>([\s\S]*?)<\/ForexSelling>/i);
  const bsMatch = block.match(/<BanknoteSelling>([\s\S]*?)<\/BanknoteSelling>/i);

  const rawStr = (fsMatch?.[1] || bsMatch?.[1] || "").trim().replace(",", ".");
  const rate = parseFloat(rawStr);

  if (isNaN(rate) || rate <= 0 || rate > 250) {
    return null;
  }
  return rate;
}

/**
 * Güncel Euro döviz kurunu getirir.
 */
export async function getEuroExchangeRate(): Promise<ExchangeRateResult> {
  // 1. ADIM: .env dosyasında FIXED_EUR_RATE tanımlı mı?
  const fixedRateEnv = process.env.FIXED_EUR_RATE;
  if (fixedRateEnv) {
    const fixedRate = parseFloat(fixedRateEnv.replace(",", "."));
    if (!isNaN(fixedRate) && fixedRate > 0) {
      return {
        rate: fixedRate,
        source: "fixed_env",
        lastUpdated: new Date().toISOString(),
        note: `Sabit kur kullanıldı (FIXED_EUR_RATE: ${fixedRate})`,
      };
    }
  }

  // 2. ADIM: Önbellek (Cache) kontrolü
  const now = Date.now();
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return {
      rate: cachedRate.rate,
      source: cachedRate.source,
      lastUpdated: new Date(cachedRate.timestamp).toISOString(),
    };
  }

  // 3. ADIM: TCMB XML Servisinden Canlı Kur Çekme
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RotaryAsamblePanel/1.0; +https://asamble2440.com)",
        Accept: "application/xml, text/xml, */*",
      },
      // Next.js fetch cache: 15 dakika revalidate
      next: { revalidate: 900 },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const xmlText = await response.text();
      const parsedRate = extractEurRateFromXml(xmlText);

      if (parsedRate) {
        cachedRate = {
          rate: parsedRate,
          timestamp: now,
          source: "tcmb",
        };
        console.log(`[exchange-rate] TCMB EUR Kuru başarıyla güncellendi: 1 EUR = ${parsedRate} TRY`);
        return {
          rate: parsedRate,
          source: "tcmb",
          lastUpdated: new Date().toISOString(),
        };
      }
    }
  } catch (error: any) {
    console.warn(`[exchange-rate] TCMB kurları çekilemedi (${error?.message || error}), yedek kura geçiliyor.`);
  }

  // 4. ADIM: Güvenli Yedek Kur (Fallback)
  const fallbackRate =
    parseFloat(process.env.DEFAULT_EUR_RATE || "") || DEFAULT_FALLBACK_EUR_RATE;

  // Son başarılı önbellek varsa öncelikle onu kullan
  if (cachedRate) {
    return {
      rate: cachedRate.rate,
      source: cachedRate.source,
      lastUpdated: new Date(cachedRate.timestamp).toISOString(),
      note: "TCMB servisi yanıt vermediği için son geçerli kur kullanıldı.",
    };
  }

  return {
    rate: fallbackRate,
    source: "fallback",
    lastUpdated: new Date().toISOString(),
    note: `TCMB servisine erişilemediği için sistem yedek kuru (${fallbackRate}) uygulandı.`,
  };
}

/**
 * Euro tutarını güncel kur ile Türk Lirası'na (TRY) çevirir.
 *
 * @param eurAmount Euro cinsinden tutar (örn: 405)
 * @param rate Uygulanacak kur (örn: 38.50)
 */
export function convertEurToTry(eurAmount: number, rate: number) {
  const tryValue = Math.round(eurAmount * rate * 100) / 100;
  return {
    amountEur: Number(eurAmount.toFixed(2)),
    amountTry: tryValue,
    amountFormatted: tryValue.toFixed(2),
    rate: Number(rate.toFixed(4)),
  };
}

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Türk Lirası formatlama yardımcısı (örn: 15.592,50 ₺)
 */
export function formatTry(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return tryFormatter.format(amount);
}

/**
 * Kur gösterim yardımcısı (örn: 38,50)
 */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}
