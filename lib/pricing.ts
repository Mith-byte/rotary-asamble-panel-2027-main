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
 * Oda tipine ve misafir listesine göre toplam oda fiyatını hesaplar.
 *
 * Kurallar:
 * 1. Tek kişilik (1 Kişi) veya konaklamasız: 1x Yetişkin Fiyatı
 * 2. 2 Kişilik Odalar (Double):
 *    - hasRoommate = true ve 2. kişi varsa: 2x Yetişkin Fiyatı (Kalan kapasite: 0)
 *    - hasRoommate = false (tek kişi): 1x Yetişkin Fiyatı (Kalan kapasite: 1)
 * 3. Aile Odaları (3 Kişilik Odalar):
 *    - Zorunlu 2 Yetişkin: 2x Yetişkin Fiyatı
 *    - Opsiyonel 1 veya 2 Çocuk:
 *        - 0-6 yaş: 0 €
 *        - 6-12 yaş: %50 indirimli
 *        - 12+ yaş: tam ücret
 */
export function calculateReservationPrice({
  adultPrice,
  capacity,
  hasRoommate,
  children = [],
}: {
  adultPrice: number;
  capacity: number;
  hasRoommate?: boolean;
  children?: Array<{ birthDate: string; firstName?: string; lastName?: string }>;
}): RoomCalculationResult {
  const items: PriceBreakdownItem[] = [];

  // 1. 2 Kişilik Oda (Double)
  if (capacity === 2) {
    if (hasRoommate) {
      items.push({
        label: "2 Yetişkin (Oda Arkadaşı Dahil)",
        count: 2,
        unitPrice: adultPrice,
        total: adultPrice * 2,
        note: "Oda dolu",
      });
      return {
        totalAmount: adultPrice * 2,
        adultPrice,
        items,
        remainingCapacity: 0,
      };
    } else {
      items.push({
        label: "1 Yetişkin (Tek Kişilik Kayıt)",
        count: 1,
        unitPrice: adultPrice,
        total: adultPrice,
        note: "1 kişilik boş yer (Kalan kapasite: 1)",
      });
      return {
        totalAmount: adultPrice,
        adultPrice,
        items,
        remainingCapacity: 1,
      };
    }
  }

  // 2. Aile Odası (3 Kişilik Oda)
  if (capacity === 3) {
    // Zorunlu 2 Yetişkin
    items.push({
      label: "2 Yetişkin",
      count: 2,
      unitPrice: adultPrice,
      total: adultPrice * 2,
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
      totalAmount: total,
      adultPrice,
      items,
      remainingCapacity: Math.max(0, 3 - (2 + children.length)),
    };
  }

  // 3. Tek kişilik oda veya konaklamasız
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
