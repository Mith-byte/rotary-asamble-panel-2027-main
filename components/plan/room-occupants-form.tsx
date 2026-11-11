"use client";

import { useEffect, useMemo } from "react";
import { User, Users, Baby, Info, CheckCircle2, Plus, Trash2, BedDouble } from "lucide-react";
import {
  calculateChildAge,
  calculateReservationPrice,
  formatEuro,
  isFamilyPackage,
  type RoomCalculationResult,
} from "@/lib/pricing";
import { DonorTypeCheckboxes } from "./donor-type-checkboxes";
import {
  type AdultGuest,
  type ChildGuest,
  type RoomRegistrationType,
} from "@/types/registration";

export { type AdultGuest, type ChildGuest, type RoomRegistrationType };

interface RoomOccupantsFormProps {
  capacity: number;
  packageId?: string | null;
  packageName?: string | null;
  isFamily?: boolean;
  adultPrice: number | null;
  // Kayıt Tipi (Bireysel vs. Oda Kaydı)
  registrationType?: RoomRegistrationType;
  onRegistrationTypeChange?: (val: RoomRegistrationType) => void;
  // Bireysel Kayıtta İsim Tercihleri
  roommatePreference1?: string;
  onRoommatePreference1Change?: (val: string) => void;
  roommatePreference2?: string;
  onRoommatePreference2Change?: (val: string) => void;
  // Geriye dönük uyumluluk için hasRoommate desteği
  hasRoommate?: boolean;
  onHasRoommateChange?: (val: boolean) => void;
  // 2 Kişilik ve 3 Kişilik Odalar için Toplu Kayıt Misafirleri
  roommate: AdultGuest;
  onRoommateChange: (val: AdultGuest) => void;
  roommate2: AdultGuest;
  onRoommate2Change: (val: AdultGuest) => void;
  // Aile Odası için (2 Yetişkin + min 1, max 2 Çocuk)
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
  packageId,
  packageName,
  isFamily,
  adultPrice,
  registrationType = "individual",
  onRegistrationTypeChange,
  roommatePreference1 = "",
  onRoommatePreference1Change,
  roommatePreference2 = "",
  onRoommatePreference2Change,
  hasRoommate: legacyHasRoommate,
  onHasRoommateChange,
  roommate,
  onRoommateChange,
  roommate2,
  onRoommate2Change,
  adult2,
  onAdult2Change,
  childCount,
  onChildCountChange,
  childrenList,
  onChildrenListChange,
  errors = {},
}: RoomOccupantsFormProps) {
  const isFamilyRoom =
    isFamily ||
    isFamilyPackage(packageId) ||
    (packageName != null && packageName.includes("Aile"));

  // hasRoommate durumunu registrationType üzerinden türet
  const isGroupRoomBooking = !isFamilyRoom && (registrationType === "room" || (!onRegistrationTypeChange && !!legacyHasRoommate));

  const handleTypeChange = (type: RoomRegistrationType) => {
    if (onRegistrationTypeChange) {
      onRegistrationTypeChange(type);
    }
    if (onHasRoommateChange) {
      onHasRoommateChange(type === "room");
    }
  };

  // Aile odasında zorunlu olarak minimum 1 çocuk olmasını garanti et
  useEffect(() => {
    if (isFamilyRoom && childCount < 1) {
      onChildCountChange(1);
      if (childrenList.length === 0) {
        onChildrenListChange([
          { firstName: "", lastName: "", tcKimlik: "", birthDate: "", gender: "Erkek" },
        ]);
      }
    }
  }, [isFamilyRoom, childCount, childrenList.length, onChildCountChange, onChildrenListChange]);

  const effectiveChildCount = isFamilyRoom ? Math.max(1, childCount) : 0;

  // Canlı fiyat hesaplama
  const calculation: RoomCalculationResult = useMemo(() => {
    if (adultPrice == null) {
      return {
        totalAmount: 0,
        adultPrice: 0,
        items: [],
        remainingCapacity: isFamilyRoom
          ? 0
          : capacity === 2 && !isGroupRoomBooking
          ? 1
          : capacity === 3 && !isGroupRoomBooking
          ? 2
          : 0,
      };
    }
    return calculateReservationPrice({
      adultPrice,
      capacity,
      packageId: packageId ?? undefined,
      isFamily: isFamilyRoom,
      hasRoommate: isGroupRoomBooking,
      children: isFamilyRoom ? childrenList.slice(0, effectiveChildCount) : [],
    });
  }, [adultPrice, capacity, packageId, isFamilyRoom, isGroupRoomBooking, childrenList, effectiveChildCount]);

  // 1 Kişilik veya konaklamasız paketlerde misafir alanı gösterilmez
  if (!isFamilyRoom && capacity <= 1) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 1. AİLE ODASI (2 YETİŞKİN + EN AZ 1 ÇOCUK, MAKS 2 ÇOCUK) */}
      {isFamilyRoom && (
        <div className="border border-ink/20 p-5 bg-paper space-y-6">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-ink mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="t-sheet text-sm font-semibold text-ink">
                Aile Odası Konaklama Bilgileri (2 Yetişkin + Çocuk)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aile odasında tüm oda fiyatı tek seferde tahsil edilir (2 Yetişkin + 1 Çocuk zorunludur).
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-ink space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              Çocuk Fiyatlandırma ve Yaş Kuralı (1 Nisan 2027 Referansıyla):
            </div>
            <p className="text-muted-foreground pl-5.5">
              • <strong>0 - 6 Yaş:</strong> Ücretsiz (+0 €)<br />
              • <strong>6 - 12 Yaş:</strong> %50 İndirimli (Yetişkin fiyatının yarısı)<br />
              • <strong>12 Yaş Üzeri:</strong> Tam Ücret<br />
              Çocuk yaşları etkinlik başlangıç tarihi olan <strong>1 Nisan 2027</strong> esas alınarak doğum tarihinden otomatik hesaplanır.
            </p>
          </div>

          {/* 2. Yetişkin Bilgileri */}
          <div className="space-y-4 pt-1">
            <AdultGuestInputs
              title="2. Yetişkin Bilgileri"
              guestNumber={2}
              guest={adult2}
              onChange={onAdult2Change}
              prefix="adult2"
              errors={errors}
            />
          </div>

          {/* Çocuk Bilgileri */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-rule">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-ink" />
                <h4 className="t-sheet text-sm font-medium text-ink">
                  Çocuk Bilgileri ({effectiveChildCount} Çocuk)
                </h4>
              </div>

              {effectiveChildCount === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    onChildCountChange(2);
                    if (childrenList.length < 2) {
                      onChildrenListChange([
                        ...childrenList,
                        { firstName: "", lastName: "", tcKimlik: "", birthDate: "", gender: "Erkek" },
                      ]);
                    }
                  }}
                  className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + 1 Çocuk Daha Ekle (Toplam 2 Çocuk)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onChildCountChange(1);
                  }}
                  className="btn btn-secondary text-xs py-1 px-2.5 text-destructive flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  2. Çocuğu Kaldır
                </button>
              )}
            </div>

            {Array.from({ length: effectiveChildCount }).map((_, index) => {
              const child = childrenList[index] || {
                firstName: "",
                lastName: "",
                tcKimlik: "",
                birthDate: "",
                gender: "Erkek" as const,
              };

              const childAge = child.birthDate ? calculateChildAge(child.birthDate) : null;
              let badgeText = "Doğum tarihi seçiniz";
              let badgeColor = "bg-muted text-muted-foreground";

              if (childAge != null) {
                if (childAge <= 6) {
                  badgeText = `${childAge} Yaş — 0-6 Yaş Ücretsiz (+0 €)`;
                  badgeColor = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
                } else if (childAge <= 12) {
                  badgeText = `${childAge} Yaş — 6-12 Yaş %50 İndirimli`;
                  badgeColor = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
                } else {
                  badgeText = `${childAge} Yaş — 12+ Yaş Tam Ücret`;
                  badgeColor = "bg-ink/10 text-ink border-rule";
                }
              }

              return (
                <div
                  key={index}
                  className="border border-ink/20 p-4 md:p-5 bg-paper space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-rule">
                    <div className="flex items-center gap-2">
                      <Baby className="w-4 h-4 text-ink" />
                      <h5 className="t-sheet text-xs font-semibold text-ink">
                        {index + 1}. Çocuk {index === 0 ? "(Zorunlu)" : "(Opsiyonel 2. Çocuk)"}
                      </h5>
                    </div>
                    <span className={`text-[0.6875rem] px-2 py-0.5 border font-medium ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Ad */}
                    <div>
                      <label className="field-label">
                        Çocuğun Adı <span className="text-destructive">*</span>
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
                        className="field-input"
                      />
                      {errors[`children.${index}.firstName`] && (
                        <p className="field-error mt-1">{errors[`children.${index}.firstName`]}</p>
                      )}
                    </div>

                    {/* Soyad */}
                    <div>
                      <label className="field-label">
                        Çocuğun Soyadı <span className="text-destructive">*</span>
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
                        className="field-input"
                      />
                      {errors[`children.${index}.lastName`] && (
                        <p className="field-error mt-1">{errors[`children.${index}.lastName`]}</p>
                      )}
                    </div>

                    {/* T.C. Kimlik No */}
                    <div>
                      <label className="field-label">
                        T.C. Kimlik No <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={child.tcKimlik}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                          const updated = [...childrenList];
                          updated[index] = { ...child, tcKimlik: val };
                          onChildrenListChange(updated);
                        }}
                        placeholder="11 haneli T.C. Kimlik No"
                        className="field-input font-mono"
                      />
                      {errors[`children.${index}.tcKimlik`] && (
                        <p className="field-error mt-1">{errors[`children.${index}.tcKimlik`]}</p>
                      )}
                    </div>

                    {/* Doğum Tarihi */}
                    <div>
                      <label className="field-label">
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
                        className="field-input"
                      />
                      {errors[`children.${index}.birthDate`] && (
                        <p className="field-error mt-1">{errors[`children.${index}.birthDate`]}</p>
                      )}
                    </div>

                    {/* Cinsiyet */}
                    <div className="md:col-span-2">
                      <label className="field-label">Cinsiyet</label>
                      <div className="flex gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`child_${index}_gender`}
                            value="Erkek"
                            checked={child.gender === "Erkek"}
                            onChange={() => {
                              const updated = [...childrenList];
                              updated[index] = { ...child, gender: "Erkek" };
                              onChildrenListChange(updated);
                            }}
                          />
                          Erkek
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`child_${index}_gender`}
                            value="Kadın"
                            checked={child.gender === "Kadın"}
                            onChange={() => {
                              const updated = [...childrenList];
                              updated[index] = { ...child, gender: "Kadın" };
                              onChildrenListChange(updated);
                            }}
                          />
                          Kız
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. 2 KİŞİLİK VE 3 KİŞİLİK ODALAR (Bireysel vs. Oda Kaydı) */}
      {!isFamilyRoom && (capacity === 2 || capacity === 3) && (
        <div className="border border-ink/20 p-5 bg-paper space-y-5">
          <div className="flex items-start gap-3">
            <BedDouble className="w-5 h-5 text-ink mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="t-sheet text-sm font-semibold text-ink">
                {capacity} Kişilik Oda Kayıt Modu
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Odayı bireysel olarak kaydedip oda arkadaşınızı isimle belirtebilir ya da tüm odayı tek seferde kapatabilirsiniz.
              </p>
            </div>
          </div>

          {/* 1. SEÇİM ALANI (Bireysel Kayıt vs. Oda Kaydı) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label
              className={`flex items-start gap-3 p-3.5 border cursor-pointer transition-all ${
                !isGroupRoomBooking
                  ? "border-ink bg-ink/5 ring-1 ring-ink"
                  : "border-rule hover:border-ink/40 bg-paper"
              }`}
            >
              <input
                type="radio"
                name="room_reg_type"
                value="individual"
                checked={!isGroupRoomBooking}
                onChange={() => handleTypeChange("individual")}
                className="mt-0.5 text-ink focus:ring-ink"
              />
              <div className="text-sm">
                <span className="font-semibold text-ink block">
                  Bireysel Kayıt <span className="text-xs font-normal text-muted-foreground">(Varsayılan)</span>
                </span>
                <span className="text-xs text-muted-foreground block mt-1 leading-relaxed">
                  Yalnızca kendi adınıza <strong>1 kişilik</strong> ücret ödersiniz. Tercih ettiğiniz oda arkadaşını(ları) isimle belirtebilirsiniz.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 border cursor-pointer transition-all ${
                isGroupRoomBooking
                  ? "border-ink bg-ink/5 ring-1 ring-ink"
                  : "border-rule hover:border-ink/40 bg-paper"
              }`}
            >
              <input
                type="radio"
                name="room_reg_type"
                value="room"
                checked={isGroupRoomBooking}
                onChange={() => handleTypeChange("room")}
                className="mt-0.5 text-ink focus:ring-ink"
              />
              <div className="text-sm">
                <span className="font-semibold text-ink block">
                  Oda Kaydı (Tüm Odayı Kapat)
                </span>
                <span className="text-xs text-muted-foreground block mt-1 leading-relaxed">
                  Odadaki tüm misafirlerin bilgilerini girer ve tüm odanın <strong>({capacity} kişilik)</strong> toplam ücretini tek seferde ödersiniz.
                </span>
              </div>
            </label>
          </div>

          {/* 2. BİREYSEL KAYIT: ODA ARKADAŞI TERCİHİ ALANI */}
          {!isGroupRoomBooking && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-ink/5 border border-ink/10 text-xs text-muted-foreground flex items-start gap-2.5">
                <Info className="w-4 h-4 text-ink shrink-0 mt-0.5" />
                <div>
                  <strong>Bireysel Kayıt Modu:</strong> Şu anda yalnızca kendi paket tutarınızı (1 kişi) ödeyeceksiniz.
                  Oda arkadaşı eşleştirmesi, belirttiğiniz isimler üzerinden organizasyon acentesi tarafından panelde gerçekleştirilecektir.
                </div>
              </div>

              <div className="border border-rule p-4 bg-paper space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-rule">
                  <User className="w-4 h-4 text-ink" />
                  <h4 className="t-sheet text-xs font-semibold uppercase tracking-wider text-ink">
                    Oda Arkadaşı Tercihi
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {capacity === 2
                    ? "2 kişilik odanızı paylaşmak istediğiniz kişinin adını ve soyadını yazınız."
                    : "3 kişilik odanızı paylaşmak istediğiniz 2 arkadaşınızın adını ve soyadını yazınız."}
                </p>

                {capacity === 2 && (
                  <div>
                    <label className="field-label">
                      Oda Arkadaşınızın Adı Soyadı <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={roommatePreference1}
                      onChange={(e) => onRoommatePreference1Change && onRoommatePreference1Change(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="field-input"
                    />
                    {errors["roommatePreference1"] && (
                      <p className="field-error mt-1">{errors["roommatePreference1"]}</p>
                    )}
                  </div>
                )}

                {capacity === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">
                        1. Oda Arkadaşınızın Adı Soyadı <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={roommatePreference1}
                        onChange={(e) => onRoommatePreference1Change && onRoommatePreference1Change(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="field-input"
                      />
                      {errors["roommatePreference1"] && (
                        <p className="field-error mt-1">{errors["roommatePreference1"]}</p>
                      )}
                    </div>

                    <div>
                      <label className="field-label">
                        2. Oda Arkadaşınızın Adı Soyadı <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={roommatePreference2}
                        onChange={(e) => onRoommatePreference2Change && onRoommatePreference2Change(e.target.value)}
                        placeholder="Örn: Mehmet Demir"
                        className="field-input"
                      />
                      {errors["roommatePreference2"] && (
                        <p className="field-error mt-1">{errors["roommatePreference2"]}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. ODA KAYDI (TOPLU ÖDEME): MİSAFİR GİRİŞ FORMLARI */}
          {isGroupRoomBooking && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 text-xs text-ink">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  <strong>Toplu Oda Kaydı:</strong> Lütfen odadaki tüm misafirlerin bilgilerini eksiksiz doldurunuz.
                  Toplam {capacity} kişilik oda ücreti tek seferde tahsil edilecektir.
                </span>
              </div>

              {/* 2. Kişi (2 ve 3 Kişilik Odalar için) */}
              <AdultGuestInputs
                title={capacity === 3 ? "2. Kişi (1. Oda Arkadaşı) Bilgileri" : "2. Kişi (Oda Arkadaşı) Bilgileri"}
                guestNumber={2}
                guest={roommate}
                onChange={onRoommateChange}
                prefix="roommate"
                errors={errors}
              />

              {/* 3. Kişi (Yalnızca 3 Kişilik Odalar için) */}
              {capacity === 3 && (
                <AdultGuestInputs
                  title="3. Kişi (2. Oda Arkadaşı) Bilgileri"
                  guestNumber={3}
                  guest={roommate2}
                  onChange={onRoommate2Change}
                  prefix="roommate2"
                  errors={errors}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ODA FİYAT DÖKÜMÜ VE TOPLAM */}
      {adultPrice != null && (
        <div className="border border-ink/20 p-4 md:p-5 bg-paper space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rule">
            <span className="t-sheet text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Oda Fiyat Hesaplama Özeti
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Yetişkin Kişi Başı: {formatEuro(adultPrice)}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {calculation.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-ink">{item.label}</span>
                  {item.note && (
                    <span className="text-xs text-muted-foreground">
                      ({item.note})
                    </span>
                  )}
                </div>
                <span className="font-mono font-medium text-ink">
                  {formatEuro(item.total)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-rule flex items-baseline justify-between">
            <div>
              <span className="t-sheet text-sm font-semibold text-ink">
                Toplam Ödenecek Tutar:
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFamilyRoom
                  ? "Tüm oda tek seferde tahsil edilir (2 Yetişkin + Çocuklar)"
                  : isGroupRoomBooking
                  ? capacity === 3
                    ? "3 kişinin toplam ücreti (Tüm Oda)"
                    : "2 kişinin toplam ücreti (Tüm Oda)"
                  : "Yalnızca kendi adınıza 1 kişilik ücret (Oda arkadaşı eşleştirmeli)"}
              </p>
            </div>
            <span className="t-data text-xl md:text-2xl font-bold text-ink">
              {formatEuro(calculation.totalAmount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function AdultGuestInputs({
  title,
  guestNumber,
  guest,
  onChange,
  prefix,
  errors = {},
}: {
  title: string;
  guestNumber: number;
  guest: AdultGuest;
  onChange: (val: AdultGuest) => void;
  prefix: string;
  errors?: Record<string, string>;
}) {
  const updateField = (field: keyof AdultGuest, value: any) => {
    onChange({
      ...guest,
      [field]: value,
    });
  };

  return (
    <div className="border border-ink/20 p-4 md:p-5 bg-paper space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-rule">
        <User className="w-4 h-4 text-ink" />
        <h4 className="t-sheet text-sm font-medium text-ink">{title}</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ad */}
        <div>
          <label className="field-label">
            Ad <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={guest.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            placeholder={`${guestNumber}. kişinin adı`}
            className="field-input"
          />
          {errors[`${prefix}.firstName`] && (
            <p className="field-error mt-1">{errors[`${prefix}.firstName`]}</p>
          )}
        </div>

        {/* Soyad */}
        <div>
          <label className="field-label">
            Soyad <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={guest.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            placeholder={`${guestNumber}. kişinin soyadı`}
            className="field-input"
          />
          {errors[`${prefix}.lastName`] && (
            <p className="field-error mt-1">{errors[`${prefix}.lastName`]}</p>
          )}
        </div>

        {/* T.C. Kimlik No */}
        <div>
          <label className="field-label">
            T.C. Kimlik No <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={guest.tcKimlik}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 11);
              updateField("tcKimlik", val);
            }}
            placeholder="11 haneli T.C. Kimlik No"
            className="field-input font-mono"
          />
          {errors[`${prefix}.tcKimlik`] && (
            <p className="field-error mt-1">{errors[`${prefix}.tcKimlik`]}</p>
          )}
        </div>

        {/* Doğum Tarihi */}
        <div>
          <label className="field-label">
            Doğum Tarihi <span className="text-destructive">*</span>
          </label>
          <input
            type="date"
            value={guest.birthDate}
            onChange={(e) => updateField("birthDate", e.target.value)}
            className="field-input"
          />
          {errors[`${prefix}.birthDate`] && (
            <p className="field-error mt-1">{errors[`${prefix}.birthDate`]}</p>
          )}
        </div>

        {/* E-posta */}
        <div>
          <label className="field-label">
            E-posta <span className="text-destructive">*</span>
          </label>
          <input
            type="email"
            inputMode="email"
            value={guest.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="ornek@rotary.org"
            className="field-input"
          />
          {errors[`${prefix}.email`] && (
            <p className="field-error mt-1">{errors[`${prefix}.email`]}</p>
          )}
        </div>

        {/* Telefon */}
        <div>
          <label className="field-label">
            Telefon <span className="text-destructive">*</span>
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={guest.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="5XX XXX XX XX"
            className="field-input"
          />
          {errors[`${prefix}.phone`] && (
            <p className="field-error mt-1">{errors[`${prefix}.phone`]}</p>
          )}
        </div>

        {/* Cinsiyet */}
        <div>
          <label className="field-label">Cinsiyet</label>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name={`${prefix}_gender`}
                value="Erkek"
                checked={guest.gender === "Erkek"}
                onChange={() => updateField("gender", "Erkek")}
              />
              Erkek
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name={`${prefix}_gender`}
                value="Kadın"
                checked={guest.gender === "Kadın"}
                onChange={() => updateField("gender", "Kadın")}
              />
              Kadın
            </label>
          </div>
        </div>

        {/* Kulüp (Opsiyonel) */}
        <div>
          <label className="field-label">
            Kulüp <span className="text-xs text-muted-foreground font-normal">(Varsa)</span>
          </label>
          <input
            type="text"
            value={guest.club ?? ""}
            onChange={(e) => updateField("club", e.target.value)}
            placeholder="Kulüp adı (opsiyonel)"
            className="field-input"
          />
        </div>

        {/* Görev (Opsiyonel) */}
        <div className="md:col-span-2">
          <label className="field-label">
            Görev / Unvan <span className="text-xs text-muted-foreground font-normal">(Varsa)</span>
          </label>
          <input
            type="text"
            value={guest.gorev ?? ""}
            onChange={(e) => updateField("gorev", e.target.value)}
            placeholder="Kulüp Başkanı, Üye, vb. (opsiyonel)"
            className="field-input"
          />
        </div>

        {/* Bağışçı Türü (Donation Type) */}
        <div className="md:col-span-2 pt-2 border-t border-rule">
          <DonorTypeCheckboxes
            selected={guest.donorTypes ?? []}
            onChange={(types) => updateField("donorTypes", types)}
            idPrefix={`${prefix}_donor`}
          />
        </div>
      </div>
    </div>
  );
}
