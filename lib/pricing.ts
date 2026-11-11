/**
 * Rotary Asamble 2027 — Fiyat Hesaplama ve Çocuk Yaş Mantığı
 * Etkinlik Tarihi: 1-4 Nisan 2027
 * Referans Tarih: 2027-04-01
 */

export const EVENT_START_DATE = "2027-04-01";

const eurFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEuro(value: number | null | undefined): string {
  if (value == null) return "—";
  return eurFormatter.format(value);
}

/**
 * Doğum tarihinden etkinlik tarihindeki (1 Nisan 2027) yaşı hesaplar.
 */
export function calculateChildAge(
  birthDateString: string,
  referenceDateString: string = EVENT_START_DATE
): number {
  if (!birthDateString) return 0;
  const birth = new Date(birthDateString);
  if (isNaN(birth.getTime())) return 0;

  const ref = new Date(referenceDateString);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Çocuk yaş kuralına göre kişi başı ücreti hesaplar:
 * - 0 - 6 Yaş: Ücretsiz (0 €)
 * - 6 - 12 Yaş: %50 İndirimli (Yetişkin fiyatının yarısı)
 * - 12+ Yaş: Tam ücret
 */
export function calculateChildPrice(adultPrice: number, age: number): number {
  if (age <= 6) {
    return 0;
  }
  if (age <= 12) {
    return Math.round(adultPrice * 0.5 * 100) / 100;
  }
  return adultPrice;
}

export interface PriceBreakdownItem {
  label: string;
  count: number;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface RoomCalculationResult {
  totalAmount: number;
  adultPrice: number;
  items: PriceBreakdownItem[];
  remainingCapacity: number;
}

/**
 * Verilen paket nesnesi veya ID'sinin Aile Odası olup olmadığını kontrol eder.
 */
export function isFamilyPackage(
  pkgOrId?: { id?: string; name?: string } | string | null
): boolean {
  if (!pkgOrId) return false;
  if (typeof pkgOrId === "string") {
    return pkgOrId.startsWith("aile") || pkgOrId.toLowerCase().includes("aile");
  }
  return (
    (pkgOrId.id != null && (pkgOrId.id.startsWith("aile") || pkgOrId.id.toLowerCase().includes("aile"))) ||
    (pkgOrId.name != null && pkgOrId.name.toLowerCase().includes("aile"))
  );
}

/**
 * Oda tipine ve misafir listesine göre toplam oda fiyatını hesaplar.
 *
 * Kurallar:
 * 1. Aile Odaları (Family Room):
 *    - 2 Yetişkin (Zorunlu): 2x Yetişkin Fiyatı
 *    - 1 Çocuk Zorunlu, 1 Çocuk Opsiyonel
 *    - Çocuk Fiyatlandırması (1 Nisan 2027 referansıyla):
 *        - 0-6 Yaş: Ücretsiz (0 €)
 *        - 6-12 Yaş: %50 İndirimli (adultPrice * 0.5)
 *        - 12+ Yaş: Tam Ücret (adultPrice)
 *    - Bireysel ödeme seçeneği yoktur, tüm oda tek seferde ödenir.
 * 2. 3 Kişilik Odalar (Triple):
 *    - hasRoommate = true: 3x Yetişkin Fiyatı (Toplam Oda Tutarı, Kalan kapasite: 0)
 *    - hasRoommate = false: 1x Yetişkin Fiyatı (Bireysel Kayıt, Kalan kapasite: 2)
 * 3. 2 Kişilik Odalar (Double):
 *    - hasRoommate = true: 2x Yetişkin Fiyatı (Toplam Oda Tutarı, Kalan kapasite: 0)
 *    - hasRoommate = false: 1x Yetişkin Fiyatı (Bireysel Kayıt, Kalan kapasite: 1)
 * 4. Tek kişilik (1 Kişi) veya konaklamasız: 1x Yetişkin Fiyatı
 */
export function calculateReservationPrice({
  adultPrice,
  capacity,
  packageId,
  isFamily,
  hasRoommate,
  children = [],
}: {
  adultPrice: number;
  capacity: number;
  packageId?: string;
  isFamily?: boolean;
  hasRoommate?: boolean;
  children?: Array<{ birthDate: string; firstName?: string; lastName?: string }>;
}): RoomCalculationResult {
  const items: PriceBreakdownItem[] = [];
  const isFamilyRoom = isFamily || isFamilyPackage(packageId);

  // 1. Aile Odası (Family Room)
  if (isFamilyRoom) {
    items.push({
      label: "2 Yetişkin",
      count: 2,
      unitPrice: adultPrice,
      total: adultPrice * 2,
      note: "Zorunlu 2 Yetişkin",
    });
    let total = adultPrice * 2;

    children.forEach((child, index) => {
      const age = calculateChildAge(child.birthDate);
      const childPrice = calculateChildPrice(adultPrice, age);
      total += childPrice;

      let discountText = "Tam Ücret";
      if (age <= 6) discountText = "0-6 Yaş — Ücretsiz (+0 €)";
      else if (age <= 12) discountText = "6-12 Yaş — %50 İndirimli";

      const nameLabel = child.firstName ? ` (${child.firstName})` : "";
      items.push({
        label: `${index + 1}. Çocuk${nameLabel} [${age} Yaş]`,
        count: 1,
        unitPrice: childPrice,
        total: childPrice,
        note: discountText,
      });
    });

    return {
      totalAmount: Math.round(total * 100) / 100,
      adultPrice,
      items,
      remainingCapacity: 0,
    };
  }

  // 2. 2 Kişilik Oda (Double)
  if (capacity === 2) {
    if (hasRoommate) {
      items.push({
        label: "2 Yetişkin (Oda Arkadaşı Dahil)",
        count: 2,
        unitPrice: adultPrice,
        total: adultPrice * 2,
        note: "Tüm oda tek seferde ödeniyor",
      });
      return {
        totalAmount: adultPrice * 2,
        adultPrice,
        items,
        remainingCapacity: 0,
      };
    } else {
      items.push({
        label: "1 Yetişkin (Bireysel Kayıt)",
        count: 1,
        unitPrice: adultPrice,
        total: adultPrice,
        note: "Bireysel ödeme (Oda arkadaşı eşleştirmeli)",
      });
      return {
        totalAmount: adultPrice,
        adultPrice,
        items,
        remainingCapacity: 1,
      };
    }
  }

  // 3. 3 Kişilik Oda (Triple)
  if (capacity === 3) {
    if (hasRoommate) {
      items.push({
        label: "3 Yetişkin (2 Oda Arkadaşı Dahil)",
        count: 3,
        unitPrice: adultPrice,
        total: adultPrice * 3,
        note: "3 kişilik toplam oda ücreti tek seferde ödeniyor",
      });
      return {
        totalAmount: adultPrice * 3,
        adultPrice,
        items,
        remainingCapacity: 0,
      };
    } else {
      items.push({
        label: "1 Yetişkin (Bireysel Kayıt)",
        count: 1,
        unitPrice: adultPrice,
        total: adultPrice,
        note: "Bireysel ödeme (Oda arkadaşı eşleştirmeli)",
      });
      return {
        totalAmount: adultPrice,
        adultPrice,
        items,
        remainingCapacity: 2,
      };
    }
  }

  // 4. Tek kişilik oda veya konaklamasız
  items.push({
    label: "Kayıt Sahibi",
    count: 1,
    unitPrice: adultPrice,
    total: adultPrice,
  });

  return {
    totalAmount: adultPrice,
    adultPrice,
    items,
    remainingCapacity: 0,
  };
}
