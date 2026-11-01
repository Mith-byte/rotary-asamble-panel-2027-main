/**
 * Hafif ve Bellek İçi (In-Memory) Rate Limiter
 * API rotalarını (payment/init, payment/callback vb.) Brute-Force, Spam ve DoS saldırılarına karşı korur.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Belirli bir anahtar (IP veya user id) için istek sınırını kontrol eder.
 *
 * @param key Benzersiz kimlik (örn: "payment_init_192.168.1.1")
 * @param maxRequests İzin verilen maksimum istek sayısı
 * @param windowMs Zaman penceresi (milisaniye cinsinden, örn: 60000 = 1 dakika)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Bellek sızıntısını önlemek için periyodik temizlik (Store boyutu 2000'i aşarsa)
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || now > record.resetAt) {
    // Yeni pencere başlat
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetMs: windowMs,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, record.resetAt - now),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetMs: Math.max(0, record.resetAt - now),
  };
}
