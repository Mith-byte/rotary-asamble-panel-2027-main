"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { sendSignupOtp, resendSignupOtp } from "@/lib/actions/auth";
import { OtpVerification } from "@/components/otp-verification";
import { COUNTRIES, type Country } from "@/lib/countries";
import { isClub, isClubForDutyGroup } from "@/lib/clubs";
import { dutyLabelWithTerm, getDuty } from "@/lib/duties";
import {
  RoomOccupantsForm,
  type AdultGuest,
  type ChildGuest,
} from "@/components/plan/room-occupants-form";
import { calculateReservationPrice, formatEuro } from "@/lib/pricing";

import { Room } from "@/components/plan/room";
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

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "E-posta adresi gerekli")
    .email("Geçerli bir e-posta adresi girin"),
});

const infoSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
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

type EmailValues = z.infer<typeof emailSchema>;
type InfoValues = z.infer<typeof infoSchema>;

/* Registration really is a sequence, which is the one case where numbering a
   set of steps says something true about it. */
const steps = [
  { key: "email", label: "E-posta" },
  { key: "otp", label: "Doğrulama" },
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
        {steps.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li
              key={step.key}
              aria-current={active ? "step" : undefined}
              className={`flex flex-1 items-center gap-1.5 border-r border-ink px-1.5 py-1.5 last:border-r-0 sm:gap-2 sm:px-2.5 ${
                active ? "bg-ink text-paper" : done ? "bg-ink/10" : ""
              }`}
            >
              <span className="t-data text-[0.625rem] tabular-nums opacity-70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="t-note hidden truncate sm:inline">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="t-note mt-2 text-muted-foreground sm:hidden">
        Adım {index + 1}/{steps.length} · {steps[index].label}
      </p>
    </nav>
  );
}

/** Says a value arrived preselected from the public site, and is changeable. */
function FromLink({ children }: { children: string }) {
  return (
    <p className="mb-4 border-l-2 border-ink py-1 pl-3 text-[0.875rem]">
      {children} Değiştirebilirsiniz.
    </p>
  );
}

export function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [emailValue, setEmailValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [pricing, setPricing] = useState<PricingType>("early_bird");
  const [pricingOpen, setPricingOpen] = useState(true);

  const [gorev, setGorev] = useState<string | null>(null);
  const [gorevFromLink, setGorevFromLink] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [packageFromLink, setPackageFromLink] = useState(false);

  // Oda arkadaşı ve aile odası misafir state'leri
  const [hasRoommate, setHasRoommate] = useState(false);
  const [roommate, setRoommate] = useState<AdultGuest>({
    firstName: "",
    lastName: "",
    phone: "",
    gender: "Erkek",
  });
  const [adult2, setAdult2] = useState<AdultGuest>({
    firstName: "",
    lastName: "",
    phone: "",
    gender: "Kadın",
  });
  const [childCount, setChildCount] = useState<number>(0);
  const [childrenList, setChildrenList] = useState<ChildGuest[]>([]);
  const [occupantErrors, setOccupantErrors] = useState<Record<string, string>>({});

  const [country, setCountry] = useState<Country>(COUNTRIES[0]);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", club: "", gender: "Erkek" },
  });

  /*
    The public site links in with the görev and paket already chosen. An
    unknown or missing value is not an error — it simply leaves the field
    unset, because the registrant did not type it.
  */
  useEffect(() => {
    const gorevParam = searchParams.get("gorev");
    if (gorevParam && dutyLabelWithTerm(gorevParam)) {
      setGorev(gorevParam);
      setGorevFromLink(true);
    }

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

      if (pkgs) {
        setPackages(pkgs as PackageRow[]);
        const paketParam = searchParams.get("paket");
        if (paketParam) {
          const matchedPkg =
            (pkgs as PackageRow[]).find((p) => p.id === paketParam) ||
            (paketParam === "gunubirlik" || paketParam === "gunubirlik-toren"
              ? (pkgs as PackageRow[]).find((p) => p.id === "toren")
              : null) ||
            (paketParam === "gunubirlik-gala"
              ? (pkgs as PackageRow[]).find((p) => p.id === "gala-toren")
              : null);

          if (matchedPkg) {
            setPackageId(matchedPkg.id);
            setPackageFromLink(true);
          }
        }
      }
      if (period) setPricing(period.id as PricingType);
      else setPricingOpen(false);
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

  const calculatedReservation = useMemo(() => {
    if (!selected || selectedPrice == null) return null;
    return calculateReservationPrice({
      adultPrice: selectedPrice,
      capacity: selected.capacity ?? 1,
      hasRoommate,
      children: selected.capacity === 3 ? childrenList.slice(0, childCount) : [],
    });
  }, [selected, selectedPrice, hasRoommate, childrenList, childCount]);

  const displayTotal = calculatedReservation?.totalAmount ?? selectedPrice;

  /* No figure has been issued for any package. Until one is, there is nothing
     to transfer and nothing to prove — so the dekont cannot be required. */
  const priceIssued = selectedPrice != null;

  async function onEmailSubmit(data: EmailValues) {
    setLoading(true);
    setServerError(null);
    const result = await sendSignupOtp(data.email);
    if (result.error) setServerError(result.error);
    else {
      setEmailValue(data.email);
      setStep("otp");
    }
    setLoading(false);
  }

  async function handleVerifyOtp(otp: string): Promise<string | null> {
    const { error } = await supabase.auth.verifyOtp({
      email: emailValue,
      token: otp,
      type: "email",
    });
    if (error) return error.message;
    setStep("gorev");
    return null;
  }

  async function onInfoSubmit() {
    if (!packageId) {
      setServerError("Paket seçilmedi. Paket adımına dönüp bir paket seçin.");
      return;
    }

    // Oda misafirleri validasyonu
    setOccupantErrors({});
    const errs: Record<string, string> = {};

    if (selected?.capacity === 2 && hasRoommate) {
      if (!roommate.firstName.trim()) errs["roommate.firstName"] = "Ad zorunludur";
      if (!roommate.lastName.trim()) errs["roommate.lastName"] = "Soyad zorunludur";
    }

    if (selected?.capacity === 3) {
      if (!adult2.firstName.trim()) errs["adult2.firstName"] = "2. Yetişkin adı zorunludur";
      if (!adult2.lastName.trim()) errs["adult2.lastName"] = "2. Yetişkin soyadı zorunludur";

      for (let i = 0; i < childCount; i++) {
        const c = childrenList[i];
        if (!c?.firstName?.trim()) errs[`children.${i}.firstName`] = "Çocuk adı zorunludur";
        if (!c?.lastName?.trim()) errs[`children.${i}.lastName`] = "Çocuk soyadı zorunludur";
        if (!c?.birthDate) errs[`children.${i}.birthDate`] = "Doğum tarihi zorunludur";
      }
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
          phone: country.dial.replace("+", "") + info.phone,
          club: info.club,
          gorev,
          gender: info.gender,
          packageId,
          hasRoommate,
          roommate: hasRoommate ? roommate : null,
          adult2: selected?.capacity === 3 ? adult2 : null,
          children: selected?.capacity === 3 ? childrenList.slice(0, childCount) : [],
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setServerError(result.error || "Kayıt tamamlanamadı. Tekrar deneyin.");
        setLoading(false);
        return;
      }
      router.push("/");
    } catch {
      setServerError("Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div>
      <Stepper current={step} />

      {step === "email" && (
        <Room className="p-5 md:p-7">
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
                E-posta adresi
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ornek@eposta.com"
                {...emailForm.register("email")}
                aria-invalid={emailForm.formState.errors.email ? true : undefined}
                className="field-input"
              />
              {emailForm.formState.errors.email && (
                <p className="field-error mt-2">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>
            {serverError && (
              <p role="alert" className="field-error">
                {serverError}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Kod gönderiliyor…" : "Devam et"}
            </button>
            <p className="text-sm text-muted-foreground">
              Kaydınız zaten var mı?{" "}
              <Link href="/giris" className="text-ink underline underline-offset-[5px]">
                Giriş yapın
              </Link>
              .
            </p>
          </form>
        </Room>
      )}

      {step === "otp" && (
        <Room className="p-5 md:p-7">
          <OtpVerification
            email={emailValue}
            onVerify={handleVerifyOtp}
            onResend={() => resendSignupOtp(emailValue)}
            onBack={() => {
              setStep("email");
              setServerError(null);
            }}
          />
        </Room>
      )}

      {step === "gorev" && (
        <div>
          {gorevFromLink && (
            <FromLink>Görev, geldiğiniz bağlantıdan seçildi.</FromLink>
          )}
          <Room className="p-4 md:p-6">
            <DutyPicker value={gorev} onChange={setGorev} />
          </Room>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!gorev}
              onClick={() => {
                setServerError(null);
                setStep("paket");
              }}
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
          {packageFromLink && (
            <FromLink>Paket, geldiğiniz bağlantıdan seçildi.</FromLink>
          )}
          {!pricingOpen && (
            <p className="mb-4 border-l-2 border-ink py-1 pl-3 text-[0.875rem]">
              Kayıt dönemi henüz açılmadı. Paketleri inceleyebilirsiniz.
            </p>
          )}
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
              onClick={() => {
                setServerError(null);
                setStep("bilgiler");
              }}
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
        <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-5">
          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Seçiminiz</h2>
            <Register>
              <Row label="Görev">{dutyLabelWithTerm(gorev) ?? "—"}</Row>
              <Row label="Paket">
                {selected?.capacity === 3
                  ? selected.name.replace(/^3 Kişi/i, "Aile Odası")
                  : selected?.name ?? "—"}
              </Row>
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
          {selected && selected.capacity && selected.capacity > 1 && (
            <RoomOccupantsForm
              capacity={selected.capacity}
              adultPrice={selectedPrice}
              hasRoommate={hasRoommate}
              onHasRoommateChange={setHasRoommate}
              roommate={roommate}
              onRoommateChange={setRoommate}
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
                Paket ücretleri henüz açıklanmadı, bu yüzden şimdi ödeme
                alınmıyor. Kaydınızı tamamlayabilirsiniz; ücretler yayımlandığında
                ödeme adımı bu panelde açılacak.
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
              {loading ? "Kaydediliyor…" : "Kayıt ol"}
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
