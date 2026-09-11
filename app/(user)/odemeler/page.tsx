import { createClient } from "@/lib/supabase/server";
import { InstallmentUpload } from "./installment-upload";
import { BankDetails } from "@/components/bank-details";
import { getInstallmentCount } from "@/lib/utils";
import { PageHead, Room } from "@/components/plan/room";
import { Dimension } from "@/components/plan/dimension";
import { StateBadge } from "@/components/plan/state";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  dekont_url: string | null;
  status: "pending" | "accepted";
}

interface Package {
  /* Nullable: no instalment figure has been issued for any package. */
  early_bird_installment_price: number | null;
  round_1_installment_price: number | null;
  round_2_installment_price: number | null;
}

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export default async function OdemelerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("pricing_type, packages!package_id(early_bird_installment_price, round_1_installment_price, round_2_installment_price)")
    .eq("id", user!.id)
    .single();

  const { data: installments } = await supabase
    .from("installments")
    .select("*")
    .eq("user_id", user!.id)
    .order("installment_number", { ascending: true });

  // Generate signed URLs for existing dekont files
  const installmentData: (Installment & { signedUrl: string | null })[] = [];
  if (installments) {
    for (const inst of installments as Installment[]) {
      let signedUrl: string | null = null;
      if (inst.dekont_url) {
        const { data } = await supabase.storage
          .from("dekontlar")
          .createSignedUrl(inst.dekont_url, 60 * 60);
        signedUrl = data?.signedUrl ?? null;
      }
      installmentData.push({ ...inst, signedUrl });
    }
  }

  const pkg = profile?.packages as unknown as Package | null;
  const pricingType = profile?.pricing_type || "early_bird";
  const perInstallment = pkg?.[`${pricingType}_installment_price` as keyof Package] ?? null;
  const installmentCount = getInstallmentCount(pricingType);

  // Build display data for installments based on pricing type
  const allInstallments = Array.from({ length: installmentCount }, (_, i) => i + 1).map((num) => {
    const existing = installmentData.find((i) => i.installment_number === num);
    return {
      number: num,
      amount: existing?.amount ?? perInstallment,
      dekontUrl: existing?.dekont_url ?? null,
      signedUrl: existing?.signedUrl ?? null,
      status: existing?.status ?? null,
    };
  });

  const acceptedCount = allInstallments.filter((i) => i.status === "accepted").length;
  /* Until the district issues a figure there is nothing to pay and nothing to
     prove, so the whole payment sheet is drawn as not yet issued. */
  const priceIssued = perInstallment != null;
  const totalAmount = priceIssued ? perInstallment * installmentCount : null;

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödemeler"
        figure={priceIssued ? `${acceptedCount}/${installmentCount} ONAYLI` : undefined}
        title="Ödemeleriniz"
        lead={
          priceIssued
            ? "Her taksit için dekontunuzu yükleyin. Bölge onayladığında durumu burada görürsünüz."
            : undefined
        }
      />

      {!priceIssued ? (
        <Room draft className="p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-sheet text-[0.8125rem]">Ödeme planı</h2>
            <span className="stamp t-note">Taslak</span>
          </div>
          <p className="prose-measure mt-3 text-sm text-muted-foreground">
            Paket ücretleri henüz açıklanmadı, bu yüzden ödeme alınmıyor.
            Ücretler yayımlandığında taksitleriniz burada listelenecek ve
            dekontlarınızı bu sayfadan yükleyeceksiniz.
          </p>
        </Room>
      ) : (
        <>
          <Room className="space-y-5 p-4 md:p-6">
            <h2 className="t-sheet text-[0.8125rem]">Durum</h2>
            <Dimension
              label="Onaylanan taksit"
              value={acceptedCount}
              total={installmentCount}
              figure={`${acceptedCount} / ${installmentCount}`}
            />
            {totalAmount != null && (
              <Dimension
                label="Ödenen tutar"
                value={acceptedCount * perInstallment!}
                total={totalAmount}
                figure={`${tl.format(acceptedCount * perInstallment!)} / ${tl.format(totalAmount)}`}
              />
            )}
          </Room>

          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Taksitler</h2>
            <ul>
              {allInstallments.map((inst) => (
                <li
                  key={inst.number}
                  className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0"
                >
                  <span className="t-data w-20 shrink-0 text-[0.8125rem] text-muted-foreground">
                    {inst.number}. taksit
                  </span>
                  <span className="t-data flex-1 text-[0.9375rem]">
                    {inst.amount != null ? tl.format(inst.amount) : "—"}
                  </span>
                  {inst.status ? (
                    <StateBadge status={inst.status} />
                  ) : (
                    <span className="t-note text-muted-foreground">Yüklenmedi</span>
                  )}
                  <InstallmentUpload
                    installmentNumber={inst.number}
                    hasExisting={!!inst.dekontUrl}
                  />
                </li>
              ))}
            </ul>
          </Room>

          <Room className="p-4 md:p-6">
            <BankDetails
              totalPrice={totalAmount ?? undefined}
              installmentPrice={perInstallment ?? undefined}
              installmentCount={installmentCount}
            />
          </Room>
        </>
      )}
    </div>
  );
}
