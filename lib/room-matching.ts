/**
 * Oda arkadaşı isim eşleştirme ve normalizasyon yardımcıları.
 * Türkçe karakter uyumlu normalizasyon yaparak bireysel kayıt tercihlerini eşleştirir.
 */

export function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CandidateUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  room_id: string | null;
  room_number?: number | string | null;
}

/**
 * Beyan edilen oda arkadaşı adını sistemdeki adaylar arasında arar.
 * @param preferredName Beyan edilen ad soyad (örn: "Ahmet Yılmaz")
 * @param candidates Aday kullanıcı listesi
 * @param excludeUserId Kendi kullanıcı ID'si
 */
export function findMatchingUser(
  preferredName: string,
  candidates: CandidateUser[],
  excludeUserId?: string
): CandidateUser | null {
  const targetNorm = normalizeName(preferredName);
  if (!targetNorm) return null;

  const targetWords = targetNorm.split(" ").filter(Boolean);
  if (targetWords.length === 0) return null;

  // 1. Tam ad eşleşmesi
  for (const c of candidates) {
    if (excludeUserId && c.id === excludeUserId) continue;
    const cNorm = normalizeName(`${c.first_name ?? ""} ${c.last_name ?? ""}`);
    if (cNorm === targetNorm) {
      return c;
    }
  }

  // 2. Çoklu isim esnek eşleşmesi (örn: "Mehmet Demir" vs "Mehmet Ali Demir" veya soyad + ad)
  const targetLastName = targetWords[targetWords.length - 1];
  const targetFirstNames = targetWords.slice(0, -1);

  for (const c of candidates) {
    if (excludeUserId && c.id === excludeUserId) continue;
    const cFirstNorm = normalizeName(c.first_name);
    const cLastNorm = normalizeName(c.last_name);

    // Soyadlar birebir aynı olmalı
    if (cLastNorm !== targetLastName) continue;

    // Hedef ilk isimlerden en az biri adında geçmeli
    const hasFirstNameMatch = targetFirstNames.some((w) => cFirstNorm.includes(w));
    if (hasFirstNameMatch) {
      return c;
    }
  }

  return null;
}
