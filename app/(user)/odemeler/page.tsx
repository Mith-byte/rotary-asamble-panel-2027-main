import { createClient } from "@/lib/supabase/server";
import { PageHead, Room } from "@/components/plan/room";
import { Dimension } from "@/components/plan/dimension";
import { CreditCard, CheckCircle } from "lucide-react";
import Link from "next/link";

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
    .select("status, pricing_type, packages!package_id(early_bird_price, round_1_price, round_2_price)")
    .eq("id", user!.id)
    .single();

  const pkg = profile?.packages as any;
  const pricingType = profile?.pricing_type || "early_bird";
  
  const totalPrice = pkg?.[`${pricingType}_price`] ?? null;
  const priceIssued = totalPrice != null;
  const isPaid = profile?.status === "accepted";

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödemeler"
        title="Ödemeleriniz"
        lead={
          priceIssued
            ? "Kayıt işleminizi tamamlamak için ödemenizi sanal pos üzerinden güvenle gerçekleştirebilirsiniz."
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
            Ücretler yayımlandığında ödeme bağlantınız burada listelenecek.
          </p>
        </Room>
      ) : (
        <>
          <Room className="space-y-5 p-4 md:p-6">
            <h2 className="t-sheet text-[0.8125rem]">Durum</h2>
            <Dimension
              label="Ödenen tutar"
              value={isPaid ? totalPrice : 0}
              total={totalPrice}
              figure={`${tl.format(isPaid ? totalPrice : 0)} / ${tl.format(totalPrice)}`}
            />
          </Room>

          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Ödeme İşlemi</h2>
            {isPaid ? (
              <div className="flex items-center gap-3 p-4 bg-ink/5 border border-ink/10 rounded-md">
                <CheckCircle className="w-5 h-5 text-ink" />
                <p className="t-label text-ink">Ödemeniz tamamlanmıştır. Teşekkür ederiz.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Toplam tutar olan <strong>{tl.format(totalPrice)}</strong> ödemesini aşağıdaki bağlantıya tıklayarak sanal POS üzerinden yapabilirsiniz. Kredi kartı taksit seçenekleri ödeme sayfasında sunulacaktır.
                </p>
                
                <Link 
                  href="https://sanal-pos-linki-gelecek.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Kredi Kartı ile Öde
                </Link>
              </div>
            )}
          </Room>
        </>
      )}
    </div>
  );
}
