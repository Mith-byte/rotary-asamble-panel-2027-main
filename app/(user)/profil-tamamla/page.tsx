"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, type Country } from "@/lib/countries";
import { isClub, isClubForDutyGroup } from "@/lib/clubs";
import { dutyLabelWithTerm, getDuty } from "@/lib/duties";
import {
  RoomOccupantsForm,
  type AdultGuest,
  type ChildGuest,
} from "@/components/plan/room-occupants-form";
import { calculateReservationPrice, formatEuro, isFamilyPackage } from "@/lib/pricing";

import { Room, PageHead } from "@/components/plan/room";
import { DutyPicker } from "@/components/plan/duty-picker";
import {
  PackagePicker,
  packagePrice,
  formatPrice,
  type PackageRow,
  type PricingType,
} from "@/components/plan/package-picker";
import { PackageChips, PriceNotIssued } from "@/components/plan/package-chips";
import { ClubSelect } from "@/components/plan/club-select";
import { PhoneInput } from "@/components/plan/phone-input";
import { Register, Row } from "@/components/plan/register";

const GENDERS = ["Erkek", "Kadın"] as const;

function isValidTcKimlik(val: string): boolean {
  return /^[1-9][0-9]{10}$/.test(val || "");
}

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val || "");
}

const infoSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  tcKimlik: z
    .string()
    .min(1, "T.C. Kimlik Numarası gerekli")
    .regex(/^[1-9][0-9]{10}$/, "Geçerli bir 11 haneli T.C. Kimlik Numarası girin"),
  birthDate: z.string().min(1, "Doğum tarihi gerekli"),
  phone: z
    .string()
    .min(1, "Telefon numarası gerekli")
    .regex(/^[0-9]{7,15}$/, "Geçerli bir telefon numarası girin"),
  club: z
    .string({ message: "Kulüp seçimi gerekli" })
    .min(1, "Kulüp seçimi gerekli")
    .refine(isClub, "Listeden bir kulüp seçin"),
  gender: z.enum(GENDERS, { message: "Cinsiyet gerekli" }),
});

type InfoValues = z.infer<typeof infoSchema>;

const steps = [
  { key: "gorev", label: "Görev" },
  { key: "paket", label: "Paket" },
  { key: "bilgiler", label: "Bilgiler" },
] as const;

type Step = (typeof steps)[number]["key"];

function Stepper({ current }: { current: Step }) {
  const index = steps.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Kayıt adımları" className="mb-7">
      <ol className="flex items-stretch border border-ink">
        {steps.map((step, i) => (
          <li
            key={step.key}
            aria-current={i === index ? "step" : undefined}
            className={`flex flex-1 items-center gap-2 border-r border-ink px-2.5 py-1.5 last:border-r-0 ${
              i === index ? "bg-ink text-paper" : i < index ? "bg-ink/10" : ""
            }`}
          >
            <span className="t-data text-[0.625rem] tabular-nums opacity-70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="t-note truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function ProfileCompletionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("gorev");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [pricing, setPricing] = useState<PricingType>("early_bird");
  const [gorev, setGorev] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);

  // Oda arkadaşı state'leri (2 ve 3 kişilik odalar)
  const [hasRoommate, setHasRoommate] = useState(false);
  const [roommate, setRoommate] = useState<AdultGuest>({
    firstName: "",
    lastName: "",
    tcKimlik: "",
    birthDate: "",
    email: "",
    phone: "",
    gender: "Erkek",
    club: "",
    gorev: "",
  });
  const [roommate2, setRoommate2] = useState<AdultGuest>({
    firstName: "",
    lastName: "",
    tcKimlik: "",
    birthDate: "",
    email: "",
    phone: "",
    gender: "Kadın",
    club: "",
    gorev: "",
  });

  // Aile odası misafir state'leri (2 Yetişkin + min 1, max 2 Çocuk)
  const [adult2, setAdult2] = useState<AdultGuest>({
    firstName: "",
    lastName: "",
    tcKimlik: "",
    birthDate: "",
    email: "",
    phone: "",
    gender: "Kadın",
    club: "",
    gorev: "",
  });
  const [childCount, setChildCount] = useState<number>(1);
  const [childrenList, setChildrenList] = useState<ChildGuest[]>([
    { firstName: "", lastName: "", tcKimlik: "", birthDate: "", gender: "Erkek" },
  ]);

  const [occupantErrors, setOccupantErrors] = useState<Record<string, string>>({});

  const [country, setCountry] = useState<Country>(COUNTRIES[0]);

  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      tcKimlik: "",
      birthDate: "",
      phone: "",
      club: "",
      gender: "Erkek",
    },
  });

  useEffect(() => {
    async function load() {
      const [{ data: pkgs }, { data: period }] = await Promise.all([
        supabase.from("packages").select("*").order("sort_order", { ascending: true }),
        supabase
          .from("pricing_periods")
          .select("id")
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString())
          .single(),
      ]);
      if (pkgs) setPackages(pkgs as PackageRow[]);
      if (period) setPricing(period.id as PricingType);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Changing the görev can move the registrant to a different roster. A club
     that is no longer offered is cleared rather than carried forward — a
     Rotaract club under a Sekreter görev is not a thing that exists. */
  useEffect(() => {
    const club = infoForm.getValues("club");
    if (club && !isClubForDutyGroup(club, getDuty(gorev)?.group ?? null)) {
      infoForm.setValue("club", "", { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorev]);

  const selected = packages.find((p) => p.id === packageId) ?? null;
  const selectedPrice = selected ? packagePrice(selected, pricing) : null;
  const isFamily = isFamilyPackage(selected);

  const calculatedReservation = useMemo(() => {
    if (!selected || selectedPrice == null) return null;
    return calculateReservationPrice({
      adultPrice: selectedPrice,
      capacity: selected.capacity ?? 1,
      packageId: selected.id,
      isFamily,
      hasRoommate,
      children: isFamily ? childrenList.slice(0, Math.max(1, childCount)) : [],
    });
  }, [selected, selectedPrice, isFamily, hasRoommate, childrenList, childCount]);

  const displayTotal = calculatedReservation?.totalAmount ?? selectedPrice;

  const priceIssued = selectedPrice != null;

  async function onSubmit() {
    if (!packageId) {
      setServerError("Paket seçilmedi. Paket adımına dönüp bir paket seçin.");
      return;
    }

    // Oda misafirleri validasyonu
    setOccupantErrors({});
    const errs: Record<string, string> = {};

    if (isFamily) {
      // 2. Yetişkin
      if (!adult2.firstName?.trim()) errs["adult2.firstName"] = "2. Yetişkin adı zorunludur";
      if (!adult2.lastName?.trim()) errs["adult2.lastName"] = "2. Yetişkin soyadı zorunludur";
      if (!isValidTcKimlik(adult2.tcKimlik)) {
        errs["adult2.tcKimlik"] = "Geçerli bir 11 haneli T.C. Kimlik No girin";
      }
      if (!adult2.birthDate) errs["adult2.birthDate"] = "Doğum tarihi zorunludur";
      if (!isValidEmail(adult2.email)) {
        errs["adult2.email"] = "Geçerli bir e-posta adresi girin";
      }
      if (!adult2.phone?.trim()) errs["adult2.phone"] = "Telefon numarası zorunludur";

      // Çocuklar (İsim, Soyisim, T.C. Kimlik No, Doğum Tarihi)
      const effectiveCount = Math.max(1, childCount);
      for (let i = 0; i < effectiveCount; i++) {
        const c = childrenList[i];
        if (!c?.firstName?.trim()) errs[`children.${i}.firstName`] = `${i + 1}. çocuk adı zorunludur`;
        if (!c?.lastName?.trim()) errs[`children.${i}.lastName`] = `${i + 1}. çocuk soyadı zorunludur`;
        if (!isValidTcKimlik(c?.tcKimlik)) {
          errs[`children.${i}.tcKimlik`] = "Geçerli bir 11 haneli T.C. Kimlik No girin";
        }
        if (!c?.birthDate) errs[`children.${i}.birthDate`] = "Doğum tarihi zorunludur";
      }
    } else if (selected?.capacity === 2 && hasRoommate) {
      if (!roommate.firstName?.trim()) errs["roommate.firstName"] = "Ad zorunludur";
      if (!roommate.lastName?.trim()) errs["roommate.lastName"] = "Soyad zorunludur";
      if (!isValidTcKimlik(roommate.tcKimlik)) {
        errs["roommate.tcKimlik"] = "Geçerli bir 11 haneli T.C. Kimlik No girin";
      }
      if (!roommate.birthDate) errs["roommate.birthDate"] = "Doğum tarihi zorunludur";
      if (!isValidEmail(roommate.email)) {
        errs["roommate.email"] = "Geçerli bir e-posta adresi girin";
      }
      if (!roommate.phone?.trim()) errs["roommate.phone"] = "Telefon numarası zorunludur";
    } else if (selected?.capacity === 3 && hasRoommate) {
      // 2. Kişi
      if (!roommate.firstName?.trim()) errs["roommate.firstName"] = "2. Kişi adı zorunludur";
      if (!roommate.lastName?.trim()) errs["roommate.lastName"] = "2. Kişi soyadı zorunludur";
      if (!isValidTcKimlik(roommate.tcKimlik)) {
        errs["roommate.tcKimlik"] = "Geçerli bir 11 haneli T.C. Kimlik No girin";
      }
      if (!roommate.birthDate) errs["roommate.birthDate"] = "Doğum tarihi zorunludur";
      if (!isValidEmail(roommate.email)) {
        errs["roommate.email"] = "Geçerli bir e-posta adresi girin";
      }
      if (!roommate.phone?.trim()) errs["roommate.phone"] = "Telefon numarası zorunludur";

      // 3. Kişi
      if (!roommate2.firstName?.trim()) errs["roommate2.firstName"] = "3. Kişi adı zorunludur";
      if (!roommate2.lastName?.trim()) errs["roommate2.lastName"] = "3. Kişi soyadı zorunludur";
      if (!isValidTcKimlik(roommate2.tcKimlik)) {
        errs["roommate2.tcKimlik"] = "Geçerli bir 11 haneli T.C. Kimlik No girin";
      }
      if (!roommate2.birthDate) errs["roommate2.birthDate"] = "Doğum tarihi zorunludur";
      if (!isValidEmail(roommate2.email)) {
        errs["roommate2.email"] = "Geçerli bir e-posta adresi girin";
      }
      if (!roommate2.phone?.trim()) errs["roommate2.phone"] = "Telefon numarası zorunludur";
    }

    if (Object.keys(errs).length > 0) {
      setOccupantErrors(errs);
      setServerError("Lütfen oda misafirleri bilgilerindeki zorunlu alanları doldurun.");
      return;
    }

    try {
      setLoading(true);
      setServerError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setServerError("Oturumunuz sona erdi. Baştan giriş yapın.");
        setLoading(false);
        return;
      }

      const info = infoForm.getValues();
      const res = await fetch("/api/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: info.firstName,
          lastName: info.lastName,
          tcKimlik: info.tcKimlik,
          birthDate: info.birthDate,
          phone: country.dial.replace("+", "") + info.phone,
          club: info.club,
          gorev,
          gender: info.gender,
          packageId,
          hasRoommate: isFamily ? true : hasRoommate,
          roommate: (!isFamily && hasRoommate) ? roommate : null,
          roommate2: (!isFamily && selected?.capacity === 3 && hasRoommate) ? roommate2 : null,
          adult2: isFamily ? adult2 : null,
          children: isFamily ? childrenList.slice(0, Math.max(1, childCount)) : [],
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setServerError(result.error || "Kayıt tamamlanamadı. Tekrar deneyin.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setServerError("Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        tag="Kayıt"
        title="Kaydınızı tamamlayın"
        lead="Görevinizi ve paketinizi seçin, bilgilerinizi bırakın. Bundan sonrasını bu panelden takip edeceksiniz."
      />
      <Stepper current={step} />

      {step === "gorev" && (
        <div>
          <Room className="p-4 md:p-6">
            <DutyPicker value={gorev} onChange={setGorev} />
          </Room>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!gorev}
              onClick={() => setStep("paket")}
            >
              Devam et
            </button>
            {!gorev && (
              <p className="self-center text-sm text-muted-foreground">
                Devam etmek için görevinizi seçin.
              </p>
            )}
          </div>
        </div>
      )}

      {step === "paket" && (
        <div>
          {packages.length === 0 ? (
            <Room className="p-5 md:p-7">
              <div className="draft-ground border border-dashed border-ink/45 px-5 py-9 text-center">
                <p className="t-label text-[0.9375rem]">Paketler henüz yayımlanmadı</p>
                <p className="prose-measure mx-auto mt-2 text-sm text-muted-foreground">
                  Paketler açıklandığında bu adımda görünecek.
                </p>
              </div>
            </Room>
          ) : (
            <Room className="p-4 md:p-6">
              <PackagePicker
                packages={packages}
                value={packageId}
                onChange={setPackageId}
                pricing={pricing}
              />
            </Room>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!packageId}
              onClick={() => setStep("bilgiler")}
            >
              Devam et
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("gorev")}>
              Göreve dön
            </button>
          </div>
        </div>
      )}

      {step === "bilgiler" && (
        <form onSubmit={infoForm.handleSubmit(onSubmit)} className="space-y-5">
          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Seçiminiz</h2>
            <Register>
              <Row label="Görev">{dutyLabelWithTerm(gorev) ?? "—"}</Row>
              <Row label="Paket">{selected?.name ?? "—"}</Row>
              <Row label="Ücret">
                {displayTotal != null ? formatEuro(displayTotal) : <PriceNotIssued />}
              </Row>
            </Register>
            {selected && (
              <div className="mt-3">
                <PackageChips pkg={selected} />
              </div>
            )}
          </Room>

          <Room className="space-y-5 p-4 md:p-6">
            <h2 className="t-sheet text-[0.8125rem]">Kişisel bilgiler</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="field-label">
                  Ad
                </label>
                <input
                  id="firstName"
                  autoComplete="given-name"
                  {...infoForm.register("firstName")}
                  aria-invalid={infoForm.formState.errors.firstName ? true : undefined}
                  className="field-input"
                />
                {infoForm.formState.errors.firstName && (
                  <p className="field-error mt-2">
                    {infoForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="field-label">
                  Soyad
                </label>
                <input
                  id="lastName"
                  autoComplete="family-name"
                  {...infoForm.register("lastName")}
                  aria-invalid={infoForm.formState.errors.lastName ? true : undefined}
                  className="field-input"
                />
                {infoForm.formState.errors.lastName && (
                  <p className="field-error mt-2">
                    {infoForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="tcKimlik" className="field-label">
                  T.C. Kimlik Numarası <span className="text-destructive">*</span>
                </label>
                <input
                  id="tcKimlik"
                  type="text"
                  maxLength={11}
                  placeholder="11 haneli T.C. Kimlik No"
                  {...infoForm.register("tcKimlik")}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "");
                    infoForm.setValue("tcKimlik", cleaned, { shouldValidate: true });
                  }}
                  aria-invalid={infoForm.formState.errors.tcKimlik ? true : undefined}
                  className="field-input"
                />
                {infoForm.formState.errors.tcKimlik && (
                  <p className="field-error mt-2">
                    {infoForm.formState.errors.tcKimlik.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="birthDate" className="field-label">
                  Doğum Tarihi <span className="text-destructive">*</span>
                </label>
                <input
                  id="birthDate"
                  type="date"
                  {...infoForm.register("birthDate")}
                  aria-invalid={infoForm.formState.errors.birthDate ? true : undefined}
                  className="field-input"
                />
                {infoForm.formState.errors.birthDate && (
                  <p className="field-error mt-2">
                    {infoForm.formState.errors.birthDate.message}
                  </p>
                )}
              </div>
            </div>

            <PhoneInput
              value={infoForm.watch("phone")}
              onChange={(v) => infoForm.setValue("phone", v, { shouldValidate: true })}
              selectedCountry={country}
              onCountryChange={setCountry}
              error={infoForm.formState.errors.phone?.message}
            />

            <ClubSelect
              value={infoForm.watch("club")}
              onChange={(v) => infoForm.setValue("club", v, { shouldValidate: true })}
              error={infoForm.formState.errors.club?.message}
              gorev={gorev}
            />

            <div>
              <label htmlFor="gender" className="field-label">
                Cinsiyet
              </label>
              <select id="gender" {...infoForm.register("gender")} className="field-input">
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </Room>

          {/* Oda arkadaşı ve Aile Odası Misafir Bilgileri */}
          {selected && (isFamily || (selected.capacity && selected.capacity > 1)) && (
            <RoomOccupantsForm
              capacity={selected.capacity ?? 1}
              packageId={selected.id}
              packageName={selected.name}
              isFamily={isFamily}
              adultPrice={selectedPrice}
              hasRoommate={hasRoommate}
              onHasRoommateChange={setHasRoommate}
              roommate={roommate}
              onRoommateChange={setRoommate}
              roommate2={roommate2}
              onRoommate2Change={setRoommate2}
              adult2={adult2}
              onAdult2Change={setAdult2}
              childCount={childCount}
              onChildCountChange={setChildCount}
              childrenList={childrenList}
              onChildrenListChange={setChildrenList}
              errors={occupantErrors}
            />
          )}

          {priceIssued ? (
            <Room className="space-y-4 p-4 md:p-6">
              <h2 className="t-sheet text-[0.8125rem]">Ödeme</h2>
              <p className="text-sm text-muted-foreground">
                Kayıt işleminizi tamamladıktan sonra, kullanıcı paneliniz üzerinden kredi kartı ile güvenle ödeme yapabilirsiniz.
              </p>
            </Room>
          ) : (
            <Room draft className="p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="t-sheet text-[0.8125rem]">Ödeme</h2>
                <span className="stamp t-note">Taslak</span>
              </div>
              <p className="prose-measure mt-3 text-sm text-muted-foreground">
                Paket ücretleri henüz açıklanmadı, bu yüzden şimdi ödeme alınmıyor.
                Kaydınızı tamamlayabilirsiniz; ücretler yayımlandığında ödeme adımı
                bu panelde açılacak.
              </p>
            </Room>
          )}

          {serverError && (
            <p role="alert" className="field-error">
              {serverError}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Kaydediliyor…" : "Kaydı tamamla"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("paket")}>
              Pakete dön
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
