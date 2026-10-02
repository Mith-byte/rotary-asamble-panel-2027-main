import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHead, Room } from "@/components/plan/room";
import { Dimension } from "@/components/plan/dimension";
import { Register, Row } from "@/components/plan/register";
import { CheckCircle, Clock, CreditCard } from "lucide-react";
import { PayButton } from "./pay-button";

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export default async function OdemelerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, pricing_type, packages!package_id(name, early_bird_price, round_1_price, round_2_price)")
    .eq("id", user!.id)
    .single();

  // En son işlemi çek
  const { data: lastTx } = await admin
    .from("payment_transactions")
    .select("status, amount, created_at, pos_transaction_id")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const pkg = profile?.packages as any;
  const pricingType = profile?.pricing_type ?? "early_bird";
  const totalPrice: number | null = pkg?.[`${pricingType}_price`] ?? null;
  const priceIssued = totalPrice != null;
  const isPaid = profile?.status === "accepted";

  // POS'tan dönüş durumu (success/failed query param)
  const returnStatus = params.status;

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödemeler"
        title="Ödemeleriniz"
        lead={
          priceIssued && !isPaid
            ? "Kayıt işleminizi tamamlamak için ödemenizi sanal pos üzerinden güvenle gerçekleştirebilirsiniz."
            : undefined
        }
      />

      {/* POS'tan dönüş bildirimi */}
      {returnStatus === "success" && !isPaid && (
        <Room className="p-4 md:p-6 border-ink/30 bg-ink/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="t-label text-ink">Ödemeniz işleme alındı</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sanal POS işleminiz tamamlandı. Onay birkaç dakika içinde yansıyacaktır. Eğer durumunuz güncellenmezse lütfen bizimle iletişime geçin.
              </p>
            </div>
          </div>
        </Room>
      )}
      {returnStatus === "failed" && (
        <Room className="p-4 md:p-6 border-destructive/30 bg-destructive/5">
          <p className="t-label text-destructive">Ödeme başarısız</p>
          <p className="text-sm text-muted-foreground mt-1">
            İşlem tamamlanamadı. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.
          </p>
        </Room>
      )}

      {!priceIssued ? (
        <Room draft className="p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-sheet text-[0.8125rem]">Ödeme planı</h2>
            <span className="stamp t-note">Taslak</span>
          </div>
          <p className="prose-measure mt-3 text-sm text-muted-foreground">
            Paket ücretleri henüz açıklanmadı, bu yüzden ödeme alınmıyor.
            Ücretler yayımlandığında ödeme bağlantınız burada listelenecek.
          </p>
        </Room>
      ) : (
        <>
          {/* Ödeme durumu göstergesi */}
          <Room className="space-y-5 p-4 md:p-6">
            <h2 className="t-sheet text-[0.8125rem]">Durum</h2>
            <Dimension
              label="Ödenen tutar"
              value={isPaid ? totalPrice : 0}
              total={totalPrice}
              figure={`${tl.format(isPaid ? totalPrice : 0)} / ${tl.format(totalPrice)}`}
            />
          </Room>

          {/* İşlem geçmişi */}
          {lastTx && (
            <Room className="p-4 md:p-6">
              <h2 className="t-sheet mb-3 text-[0.8125rem]">Son İşlem</h2>
              <Register>
                <Row label="Durum">
                  {lastTx.status === "completed" ? (
                    <span className="text-ink font-medium">Tamamlandı</span>
                  ) : lastTx.status === "failed" ? (
                    <span className="text-destructive font-medium">Başarısız</span>
                  ) : (
                    <span className="text-yellow-400 font-medium">Beklemede</span>
                  )}
                </Row>
                <Row label="Tutar">{tl.format(lastTx.amount)}</Row>
                {lastTx.pos_transaction_id && (
                  <Row label="İşlem No">{lastTx.pos_transaction_id}</Row>
                )}
                <Row label="Tarih">
                  {new Date(lastTx.created_at).toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Row>
              </Register>
            </Room>
          )}

          {/* Ödeme işlemi */}
          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Ödeme İşlemi</h2>
            {isPaid ? (
              <div className="flex items-center gap-3 p-4 bg-ink/5 border border-ink/10">
                <CheckCircle className="w-5 h-5 text-ink shrink-0" />
                <div>
                  <p className="t-label text-ink">Ödemeniz tamamlanmıştır</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Kaydınız onaylandı. Teşekkür ederiz.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Toplam tutar olan <strong>{tl.format(totalPrice)}</strong> ödemesini aşağıdaki butona
                  tıklayarak sanal POS üzerinden yapabilirsiniz. Kredi kartı taksit seçenekleri
                  ödeme sayfasında sunulacaktır.
                </p>
                <PayButton amount={totalPrice} />
              </div>
            )}
          </Room>
        </>
      )}
    </div>
  );
}
