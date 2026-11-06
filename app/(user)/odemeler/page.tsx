import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHead, Room } from "@/components/plan/room";
import { Dimension } from "@/components/plan/dimension";
import { Register, Row } from "@/components/plan/register";
import { CheckCircle, Clock, Users, Baby } from "lucide-react";
import { PayButton } from "./pay-button";
import { formatEuro } from "@/lib/pricing";
import { getEuroExchangeRate, formatTry, formatRate } from "@/lib/exchange-rate";

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
    .select("status, pricing_type, total_amount, has_roommate, room_id, packages!package_id(name, capacity, early_bird_price, round_1_price, round_2_price)")
    .eq("id", user!.id)
    .single();

  // En son işlemi çek
  const { data: lastTx } = await admin
    .from("payment_transactions")
    .select("status, amount, currency, created_at, pos_transaction_id, pos_response")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const pkg = profile?.packages as any;
  const pricingType = profile?.pricing_type ?? "early_bird";
  const defaultBasePrice: number | null = pkg?.[`${pricingType}_price`] ?? null;

  // Profilde kayıtlı total_amount varsa onu kullan, yoksa paket baz fiyatını al
  const totalPrice: number | null =
    profile?.total_amount != null
      ? Number(profile.total_amount)
      : defaultBasePrice;

  const priceIssued = totalPrice != null;
  const isPaid = profile?.status === "accepted";

  // Güncel Euro/TL Kuru ve Dönüşüm Bilgisi
  const rateInfo = await getEuroExchangeRate();
  const eurRate = rateInfo.rate;
  const totalTryAmount =
    totalPrice != null ? Math.round(totalPrice * eurRate * 100) / 100 : null;

  // Oda misafirlerini çek (Döküm için)
  let roomGuests: Array<{
    guest_type: "adult" | "child";
    first_name: string;
    last_name: string;
    price: number;
    age: number | null;
  }> = [];

  if (profile?.room_id) {
    const { data: guests } = await admin
      .from("room_guests")
      .select("guest_type, first_name, last_name, price, age")
      .eq("room_id", profile.room_id);

    if (guests) {
      roomGuests = guests as any;
    }
  }

  const packageName = pkg?.capacity === 3
    ? pkg.name?.replace(/^3 Kişi/i, "Aile Odası")
    : pkg?.name;

  // POS'tan dönüş durumu (success/failed query param)
  const returnStatus = params.status;

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödemeler"
        title="Ödemeleriniz"
        lead={
          priceIssued && !isPaid
            ? "Kayıt işleminizi tamamlamak için ödemenizi sanal POS üzerinden güvenle gerçekleştirebilirsiniz."
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
              figure={`${formatEuro(isPaid ? totalPrice : 0)} / ${formatEuro(totalPrice)}`}
            />
          </Room>

          {/* Oda ve Misafir Fiyat Detayları */}
          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Rezervasyon & Fiyat Dökümü</h2>
            <Register>
              <Row label="Seçili Paket">{packageName ?? "—"}</Row>
              <Row label="Kayıt Sahibi">{formatEuro(defaultBasePrice)}</Row>
              {roomGuests.map((g, idx) => (
                <Row
                  key={idx}
                  label={
                    g.guest_type === "child"
                      ? `Çocuk (${g.first_name} ${g.last_name}${g.age != null ? `, ${g.age} yaş` : ""})`
                      : `2. Yetişkin (${g.first_name} ${g.last_name})`
                  }
                >
                  {g.price === 0 ? "Ücretsiz (0 €)" : formatEuro(g.price)}
                </Row>
              ))}
              <Row label="Toplam Oda Tutarı">
                <span className="font-semibold text-ink">{formatEuro(totalPrice)}</span>
              </Row>
            </Register>
          </Room>

          {/* İşlem geçmişi */}
          {lastTx && (
            <Room className="p-4 md:p-6">
              <h2 className="t-sheet mb-3 text-[0.8125rem]">Son İşlem</h2>
              <Register>
                <Row label="Durum">
                  {lastTx.status === "completed" || (lastTx.status as string) === "paid" || (lastTx.status as string) === "success" ? (
                    <span className="text-ink font-medium">Tamamlandı</span>
                  ) : lastTx.status === "failed" ? (
                    <span className="text-destructive font-medium">Başarısız</span>
                  ) : (
                    <span className="text-yellow-400 font-medium">Beklemede</span>
                  )}
                </Row>
                <Row label="Tutar">
                  {lastTx.currency === "TRY"
                    ? (lastTx.pos_response && typeof lastTx.pos_response === "object" && (lastTx.pos_response as any).original_amount
                        ? `${formatEuro((lastTx.pos_response as any).original_amount)} (${formatTry(lastTx.amount)})`
                        : formatTry(lastTx.amount))
                    : formatEuro(lastTx.amount)}
                </Row>
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
                  Toplam tutar olan <strong>{formatEuro(totalPrice)}</strong> ödemesini aşağıdaki butona
                  tıklayarak İş Bankası Sanal POS sistemi üzerinden güvenle gerçekleştirebilirsiniz.
                </p>

                {/* Şeffaf Kur ve TL Tutar Bilgilendirmesi */}
                <div className="p-3.5 bg-ink/5 border border-ink/10 space-y-1.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-muted-foreground">Paket Tutarı:</span>
                    <span className="font-semibold text-ink">{formatEuro(totalPrice)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-muted-foreground">Güncel TCMB Kuru:</span>
                    <span className="text-ink">1 € = {formatRate(eurRate)} ₺</span>
                  </div>
                  <div className="border-t border-ink/10 pt-1.5 flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium text-ink">Kartınızdan Çekilecek Toplam Tutar:</span>
                    <span className="font-bold text-ink text-base">{formatTry(totalTryAmount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    * Kartınızdan tahsilat doğrudan Türk Lirası (₺) olarak yapılacaktır. Döviz hesabına veya kartına ihtiyaç duyulmaz.
                  </p>
                </div>

                <PayButton
                  amount={totalPrice}
                  tryAmount={totalTryAmount}
                  eurRate={eurRate}
                />
              </div>
            )}
          </Room>
        </>
      )}
    </div>
  );
}
