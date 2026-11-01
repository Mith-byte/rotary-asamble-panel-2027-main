"use client";

import { useMemo } from "react";
import { User, Users, Baby, Info, CheckCircle2 } from "lucide-react";
import {
  calculateChildAge,
  calculateChildPrice,
  calculateReservationPrice,
  formatEuro,
  type RoomCalculationResult,
} from "@/lib/pricing";

export interface AdultGuest {
  firstName: string;
  lastName: string;
  phone: string;
  gender: "Erkek" | "Kadın";
  club?: string;
  email?: string;
}

export interface ChildGuest {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "Erkek" | "Kadın";
}

interface RoomOccupantsFormProps {
  capacity: number;
  adultPrice: number | null;
  hasRoommate: boolean;
  onHasRoommateChange: (val: boolean) => void;
  roommate: AdultGuest;
  onRoommateChange: (val: AdultGuest) => void;
  adult2: AdultGuest;
  onAdult2Change: (val: AdultGuest) => void;
  childCount: number;
  onChildCountChange: (count: number) => void;
  childrenList: ChildGuest[];
  onChildrenListChange: (children: ChildGuest[]) => void;
  errors?: Record<string, string>;
}

export function RoomOccupantsForm({
  capacity,
  adultPrice,
  hasRoommate,
  onHasRoommateChange,
  roommate,
  onRoommateChange,
  adult2,
  onAdult2Change,
  childCount,
  onChildCountChange,
  childrenList,
  onChildrenListChange,
  errors = {},
}: RoomOccupantsFormProps) {
  // Canlı fiyat hesaplama
  const calculation: RoomCalculationResult = useMemo(() => {
    if (adultPrice == null) {
      return {
        totalAmount: 0,
        adultPrice: 0,
        items: [],
        remainingCapacity: capacity === 2 && !hasRoommate ? 1 : 0,
      };
    }
    return calculateReservationPrice({
      adultPrice,
      capacity,
      hasRoommate,
      children: childrenList.slice(0, childCount),
    });
  }, [adultPrice, capacity, hasRoommate, childrenList, childCount]);

  // 1 Kişilik veya konaklamasız paketlerde misafir alanı gösterilmez
  if (capacity <= 1) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 2 KİŞİLİK ODA (DOUBLE) MANTIĞI */}
      {capacity === 2 && (
        <div className="border border-ink/20 p-5 bg-paper space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-ink mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="t-sheet text-sm font-semibold text-ink">
                2 Kişilik Oda (Double) Planlaması
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Odayı bir arkadaşınızla paylaşabilir veya tek kişi olarak konaklayabilirsiniz.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 border border-rule cursor-pointer hover:bg-ink/5 transition-colors">
            <input
              type="checkbox"
              checked={hasRoommate}
              onChange={(e) => onHasRoommateChange(e.target.checked)}
              className="h-4 w-4 rounded border-ink text-ink accent-ink"
            />
            <span className="t-label text-sm">Oda Arkadaşım Var (2 Kişilik Kayıt)</span>
          </label>

          {hasRoommate ? (
            <div className="space-y-4 pt-2 border-t border-rule">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-ink" />
                <h4 className="t-label text-sm font-semibold">2. Kişi (Oda Arkadaşı) Bilgileri</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">
                    Ad <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={roommate.firstName}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, firstName: e.target.value })
                    }
                    placeholder="Oda arkadaşınızın adı"
                    className="field-input"
                  />
                  {errors["roommate.firstName"] && (
                    <p className="field-error mt-1">{errors["roommate.firstName"]}</p>
                  )}
                </div>

                <div>
                  <label className="field-label">
                    Soyad <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={roommate.lastName}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, lastName: e.target.value })
                    }
                    placeholder="Oda arkadaşınızın soyadı"
                    className="field-input"
                  />
                  {errors["roommate.lastName"] && (
                    <p className="field-error mt-1">{errors["roommate.lastName"]}</p>
                  )}
                </div>

                <div>
                  <label className="field-label">Telefon</label>
                  <input
                    type="tel"
                    value={roommate.phone}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, phone: e.target.value })
                    }
                    placeholder="5XXXXXXXXX"
                    className="field-input"
                  />
                </div>

                <div>
                  <label className="field-label">
                    Cinsiyet <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={roommate.gender}
                    onChange={(e) =>
                      onRoommateChange({
                        ...roommate,
                        gender: e.target.value as "Erkek" | "Kadın",
                      })
                    }
                    className="field-input"
                  >
                    <option value="Erkek">Erkek</option>
                    <option value="Kadın">Kadın</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                Tek kişi kayıt oluyorsunuz. Odanızda <strong>1 kişilik boş yer</strong> görünecek
                (Kalan Kapasite: 1) ve sadece <strong>1 kişilik oda ücreti</strong> tahsil edilecektir.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3 KİŞİLİK ODA (AİLE ODASI) MANTIĞI */}
      {capacity === 3 && (
        <div className="border border-ink/20 p-5 bg-paper space-y-5">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-ink mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="t-sheet text-sm font-semibold text-ink">
                Aile Odası Konaklama Bilgileri
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aile odalarında <strong>2 Yetişkin zorunludur</strong>. Opsiyonel olarak 1 veya 2
                çocuk eklenebilir.
              </p>
            </div>
          </div>

          {/* 2. Yetişkin (Zorunlu) */}
          <div className="space-y-4 pt-3 border-t border-rule">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-ink" />
              <h4 className="t-label text-sm font-semibold">
                2. Yetişkin Bilgileri <span className="text-destructive">*</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">
                  Ad <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={adult2.firstName}
                  onChange={(e) => onAdult2Change({ ...adult2, firstName: e.target.value })}
                  placeholder="2. Yetişkin Adı"
                  className="field-input"
                />
                {errors["adult2.firstName"] && (
                  <p className="field-error mt-1">{errors["adult2.firstName"]}</p>
                )}
              </div>

              <div>
                <label className="field-label">
                  Soyad <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={adult2.lastName}
                  onChange={(e) => onAdult2Change({ ...adult2, lastName: e.target.value })}
                  placeholder="2. Yetişkin Soyadı"
                  className="field-input"
                />
                {errors["adult2.lastName"] && (
                  <p className="field-error mt-1">{errors["adult2.lastName"]}</p>
                )}
              </div>

              <div>
                <label className="field-label">Telefon</label>
                <input
                  type="tel"
                  value={adult2.phone}
                  onChange={(e) => onAdult2Change({ ...adult2, phone: e.target.value })}
                  placeholder="5XXXXXXXXX"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">
                  Cinsiyet <span className="text-destructive">*</span>
                </label>
                <select
                  value={adult2.gender}
                  onChange={(e) =>
                    onAdult2Change({ ...adult2, gender: e.target.value as "Erkek" | "Kadın" })
                  }
                  className="field-input"
                >
                  <option value="Erkek">Erkek</option>
                  <option value="Kadın">Kadın</option>
                </select>
              </div>
            </div>
          </div>

          {/* Çocuk Seçimi ve Bilgileri */}
          <div className="space-y-4 pt-3 border-t border-rule">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-ink" />
                <h4 className="t-label text-sm font-semibold">Çocuk Misafirler (Opsiyonel)</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Çocuk Sayısı:</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        onChildCountChange(num);
                        const updated = [...childrenList];
                        while (updated.length < num) {
                          updated.push({
                            firstName: "",
                            lastName: "",
                            birthDate: "",
                            gender: "Erkek",
                          });
                        }
                        onChildrenListChange(updated);
                      }}
                      className={`px-3 py-1 text-xs font-medium border transition-colors ${
                        childCount === num
                          ? "bg-ink text-paper border-ink"
                          : "bg-paper text-ink border-rule hover:border-ink"
                      }`}
                    >
                      {num === 0 ? "Yok" : `${num} Çocuk`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {childCount > 0 && (
              <div className="space-y-4">
                {Array.from({ length: childCount }).map((_, index) => {
                  const child = childrenList[index] || {
                    firstName: "",
                    lastName: "",
                    birthDate: "",
                    gender: "Erkek",
                  };
                  const age = child.birthDate ? calculateChildAge(child.birthDate) : null;
                  const childPriceVal =
                    adultPrice != null && age != null
                      ? calculateChildPrice(adultPrice, age)
                      : null;

                  return (
                    <div
                      key={index}
                      className="p-4 border border-dashed border-ink/30 bg-ink/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold t-sheet text-ink">
                          {index + 1}. Çocuk Bilgileri
                        </span>
                        {age != null && child.birthDate && (
                          <span
                            className={`text-xs px-2 py-0.5 font-medium border ${
                              age <= 6
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                                : age <= 12
                                ? "bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-300"
                                : "bg-neutral-500/15 border-neutral-500/40 text-neutral-800 dark:text-neutral-300"
                            }`}
                          >
                            {age} Yaşında —{" "}
                            {age <= 6
                              ? "Ücretsiz (0 €)"
                              : age <= 12
                              ? `%50 İndirimli (${formatEuro(childPriceVal)})`
                              : `Tam Ücret (${formatEuro(childPriceVal)})`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="field-label text-xs">
                            Ad <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={child.firstName}
                            onChange={(e) => {
                              const updated = [...childrenList];
                              updated[index] = { ...child, firstName: e.target.value };
                              onChildrenListChange(updated);
                            }}
                            placeholder="Çocuğun adı"
                            className="field-input text-sm"
                          />
                          {errors[`children.${index}.firstName`] && (
                            <p className="field-error mt-1 text-xs">
                              {errors[`children.${index}.firstName`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="field-label text-xs">
                            Soyad <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={child.lastName}
                            onChange={(e) => {
                              const updated = [...childrenList];
                              updated[index] = { ...child, lastName: e.target.value };
                              onChildrenListChange(updated);
                            }}
                            placeholder="Çocuğun soyadı"
                            className="field-input text-sm"
                          />
                          {errors[`children.${index}.lastName`] && (
                            <p className="field-error mt-1 text-xs">
                              {errors[`children.${index}.lastName`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="field-label text-xs">
                            Doğum Tarihi <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="date"
                            value={child.birthDate}
                            onChange={(e) => {
                              const updated = [...childrenList];
                              updated[index] = { ...child, birthDate: e.target.value };
                              onChildrenListChange(updated);
                            }}
                            className="field-input text-sm"
                          />
                          {errors[`children.${index}.birthDate`] && (
                            <p className="field-error mt-1 text-xs">
                              {errors[`children.${index}.birthDate`]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DİNAMİK SEPET / HESAPLAMA DÖKÜMÜ (Euro Bazında) */}
      {adultPrice != null && calculation.items.length > 0 && (
        <div className="border border-ink p-4 bg-ink/5 space-y-3">
          <div className="flex items-center justify-between border-b border-ink/20 pb-2">
            <h4 className="t-sheet text-xs font-semibold text-ink uppercase tracking-wide">
              Oda Fiyat Dökümü
            </h4>
            <span className="text-xs text-muted-foreground">Kişi Başı Baz Fiyat: {formatEuro(adultPrice)}</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {calculation.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-ink shrink-0" />
                  <span>{item.label}</span>
                  {item.note && (
                    <span className="text-[0.6875rem] opacity-75 italic">({item.note})</span>
                  )}
                </span>
                <span className="font-mono text-ink font-medium">{formatEuro(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-ink pt-2.5 flex items-baseline justify-between">
            <div>
              <span className="t-sheet text-sm font-bold text-ink">Toplam Oda Ücreti</span>
              {calculation.remainingCapacity > 0 && (
                <p className="text-[0.6875rem] text-amber-700 dark:text-amber-400 mt-0.5">
                  Odanızda {calculation.remainingCapacity} kişilik boş yer kalacaktır.
                </p>
              )}
            </div>
            <span className="text-base font-bold font-mono text-ink">
              {formatEuro(calculation.totalAmount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
