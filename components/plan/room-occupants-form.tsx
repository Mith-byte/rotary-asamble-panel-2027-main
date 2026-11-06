"use client";

import { useEffect, useMemo } from "react";
import { User, Users, Baby, Info, CheckCircle2, Plus, Trash2 } from "lucide-react";
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
  tcKimlik: string;
  birthDate: string;
  email: string;
  phone: string;
  gender: "Erkek" | "Kadın";
  club?: string;
  gorev?: string;
}

export interface ChildGuest {
  firstName: string;
  lastName: string;
  tcKimlik: string;
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
  // Aile odalarında zorunlu olarak minimum 1 çocuk olmasını garanti et
  useEffect(() => {
    if (capacity === 3 && childCount < 1) {
      onChildCountChange(1);
      if (childrenList.length === 0) {
        onChildrenListChange([
          { firstName: "", lastName: "", tcKimlik: "", birthDate: "", gender: "Erkek" },
        ]);
      }
    }
  }, [capacity, childCount, childrenList.length, onChildCountChange, onChildrenListChange]);

  // Canlı fiyat hesaplama
  const effectiveChildCount = capacity === 3 ? Math.max(1, childCount) : 0;
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
      children: capacity === 3 ? childrenList.slice(0, effectiveChildCount) : [],
    });
  }, [adultPrice, capacity, hasRoommate, childrenList, effectiveChildCount]);

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
            <span className="t-label text-sm font-medium">Oda Arkadaşım Var (2 Kişilik Kayıt)</span>
          </label>

          {hasRoommate ? (
            <div className="space-y-4 pt-3 border-t border-rule">
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
                  <label className="field-label">
                    T.C. Kimlik Numarası <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={roommate.tcKimlik || ""}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, tcKimlik: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="11 haneli T.C. Kimlik No"
                    className="field-input"
                  />
                  {errors["roommate.tcKimlik"] && (
                    <p className="field-error mt-1">{errors["roommate.tcKimlik"]}</p>
                  )}
                </div>

                <div>
                  <label className="field-label">
                    Doğum Tarihi <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={roommate.birthDate || ""}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, birthDate: e.target.value })
                    }
                    className="field-input"
                  />
                  {errors["roommate.birthDate"] && (
                    <p className="field-error mt-1">{errors["roommate.birthDate"]}</p>
                  )}
                </div>

                <div>
                  <label className="field-label">
                    E-posta <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={roommate.email || ""}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, email: e.target.value })
                    }
                    placeholder="ornek@eposta.com"
                    className="field-input"
                  />
                  {errors["roommate.email"] && (
                    <p className="field-error mt-1">{errors["roommate.email"]}</p>
                  )}
                </div>

                <div>
                  <label className="field-label">
                    Telefon <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="tel"
                    value={roommate.phone}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, phone: e.target.value })
                    }
                    placeholder="5XXXXXXXXX"
                    className="field-input"
                  />
                  {errors["roommate.phone"] && (
                    <p className="field-error mt-1">{errors["roommate.phone"]}</p>
                  )}
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

                <div>
                  <label className="field-label">Kulüp Adı (Opsiyonel)</label>
                  <input
                    type="text"
                    value={roommate.club || ""}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, club: e.target.value })
                    }
                    placeholder="Varsa Rotary kulübü"
                    className="field-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label">Görev (Opsiyonel)</label>
                  <input
                    type="text"
                    value={roommate.gorev || ""}
                    onChange={(e) =>
                      onRoommateChange({ ...roommate, gorev: e.target.value })
                    }
                    placeholder="Varsa kulüp / bölge görevi"
                    className="field-input"
                  />
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
                Aile odalarında zorunlu olarak <strong>2 Yetişkin + 1 Çocuk</strong> yapısı bulunmaktadır.
                İstenirse &apos;1 Çocuk Daha Ekle&apos; seçeneğiyle çocuk sayısı 2&apos;ye çıkarılabilir.
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
                <label className="field-label">
                  T.C. Kimlik Numarası <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={adult2.tcKimlik || ""}
                  onChange={(e) =>
                    onAdult2Change({ ...adult2, tcKimlik: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="11 haneli T.C. Kimlik No"
                  className="field-input"
                />
                {errors["adult2.tcKimlik"] && (
                  <p className="field-error mt-1">{errors["adult2.tcKimlik"]}</p>
                )}
              </div>

              <div>
                <label className="field-label">
                  Doğum Tarihi <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={adult2.birthDate || ""}
                  onChange={(e) =>
                    onAdult2Change({ ...adult2, birthDate: e.target.value })
                  }
                  className="field-input"
                />
                {errors["adult2.birthDate"] && (
                  <p className="field-error mt-1">{errors["adult2.birthDate"]}</p>
                )}
              </div>

              <div>
                <label className="field-label">
                  E-posta <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={adult2.email || ""}
                  onChange={(e) => onAdult2Change({ ...adult2, email: e.target.value })}
                  placeholder="2. yetiskin e-postası"
                  className="field-input"
                />
                {errors["adult2.email"] && (
                  <p className="field-error mt-1">{errors["adult2.email"]}</p>
                )}
              </div>

              <div>
                <label className="field-label">
                  Telefon <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  value={adult2.phone}
                  onChange={(e) => onAdult2Change({ ...adult2, phone: e.target.value })}
                  placeholder="5XXXXXXXXX"
                  className="field-input"
                />
                {errors["adult2.phone"] && (
                  <p className="field-error mt-1">{errors["adult2.phone"]}</p>
                )}
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

              <div>
                <label className="field-label">Kulüp Adı (Opsiyonel)</label>
                <input
                  type="text"
                  value={adult2.club || ""}
                  onChange={(e) => onAdult2Change({ ...adult2, club: e.target.value })}
                  placeholder="Varsa Rotary kulübü"
                  className="field-input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="field-label">Görev (Opsiyonel)</label>
                <input
                  type="text"
                  value={adult2.gorev || ""}
                  onChange={(e) => onAdult2Change({ ...adult2, gorev: e.target.value })}
                  placeholder="Varsa kulüp / bölge görevi"
                  className="field-input"
                />
              </div>
            </div>
          </div>

          {/* Çocuk Seçimi ve Bilgileri (Zorunlu 1 Çocuk + Opsiyonel 2. Çocuk) */}
          <div className="space-y-4 pt-3 border-t border-rule">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-ink" />
                <h4 className="t-label text-sm font-semibold">Çocuk Misafir Bilgileri</h4>
                <span className="text-xs text-muted-foreground">(1. Çocuk Zorunlu)</span>
              </div>
              <div className="flex items-center gap-2">
                {effectiveChildCount < 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChildCountChange(2);
                      const updated = [...childrenList];
                      while (updated.length < 2) {
                        updated.push({
                          firstName: "",
                          lastName: "",
                          tcKimlik: "",
                          birthDate: "",
                          gender: "Erkek",
                        });
                      }
                      onChildrenListChange(updated);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-ink bg-ink text-paper hover:bg-ink/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    1 Çocuk Daha Ekle (Toplam 2 Çocuk)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onChildCountChange(1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    2. Çocuğu Kaldır
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {Array.from({ length: effectiveChildCount }).map((_, index) => {
                const child = childrenList[index] || {
                  firstName: "",
                  lastName: "",
                  tcKimlik: "",
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
                        {index + 1}. Çocuk {index === 0 ? "(Zorunlu)" : "(2. Çocuk)"}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                          T.C. Kimlik No <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={11}
                          value={child.tcKimlik || ""}
                          onChange={(e) => {
                            const updated = [...childrenList];
                            updated[index] = {
                              ...child,
                              tcKimlik: e.target.value.replace(/\D/g, ""),
                            };
                            onChildrenListChange(updated);
                          }}
                          placeholder="11 haneli T.C. No"
                          className="field-input text-sm"
                        />
                        {errors[`children.${index}.tcKimlik`] && (
                          <p className="field-error mt-1 text-xs">
                            {errors[`children.${index}.tcKimlik`]}
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

                      <div>
                        <label className="field-label text-xs">
                          Cinsiyet <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={child.gender}
                          onChange={(e) => {
                            const updated = [...childrenList];
                            updated[index] = {
                              ...child,
                              gender: e.target.value as "Erkek" | "Kadın",
                            };
                            onChildrenListChange(updated);
                          }}
                          className="field-input text-sm"
                        >
                          <option value="Erkek">Erkek</option>
                          <option value="Kadın">Kadın</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
