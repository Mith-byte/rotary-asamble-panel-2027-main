import Link from "next/link";
import { PageHead } from "@/components/plan/room";

export default function KVKKPage() {
  return (
    <div className="space-y-6">
      <PageHead
        tag="KVKK"
        title="Aydınlatma metni"
        lead="Kişisel Verilerin Korunması Kanunu kapsamında bilgilendirme."
      />

      {/* The text below is the previous event's and names its organisation.
          It is drawn as unissued rather than quietly restyled, because a
          legal notice that looks finished but names the wrong data
          controller is worse than one that says it is pending. */}
      <div className="draft-ground border border-dashed border-ink/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-label text-[0.9375rem]">Bu metin güncellenmedi</p>
          <span className="stamp t-note">Taslak</span>
        </div>
        <p className="prose-measure mt-2 text-sm text-muted-foreground">
          Aşağıdaki metin önceki etkinlikten devralındı ve bu asamblenin veri
          sorumlusunu adlandırmıyor. Bölgenin kendi metni hazırlandığında
          değiştirilecek.
        </p>
      </div>

      <div className="room-plain space-y-4 p-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            1. Veri Sorumlusu
          </h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
            kapsamında, kişisel verileriniz veri sorumlusu sıfatıyla{" "}
            <strong className="text-ink">
              Dokuz Eylül Rotaract Kulübü
            </strong>{" "}
            (&quot;Kuruluş&quot;) tarafından aşağıda açıklanan amaçlarla ve
            yöntemlerle işlenecektir.
          </p>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            2. İşlenen Kişisel Veriler
          </h2>
          <p>
            Zaman Çarkları Konferansı 2026 etkinliğine kayıt sürecinde aşağıdaki
            kişisel verileriniz işlenmektedir:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Kimlik bilgileri (ad, soyad, cinsiyet)</li>
            <li>İletişim bilgileri (e-posta adresi, telefon numarası)</li>
            <li>Kulüp ve üyelik bilgileri (kulüp adı, üye tipi)</li>
            <li>Ödeme bilgileri (dekont görselleri, taksit durumu)</li>
            <li>Konaklama bilgileri (oda ataması, oda arkadaşları)</li>
          </ul>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            3. Kişisel Verilerin İşlenme Amaçları
          </h2>
          <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Konferans kayıt işlemlerinin gerçekleştirilmesi</li>
            <li>Konaklama ve oda planlamasının yapılması</li>
            <li>Ödeme takibi ve dekont doğrulama işlemlerinin yürütülmesi</li>
            <li>Etkinlik organizasyonu ve katılımcı yönetimi</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          </ul>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            4. Kişisel Verilerin Aktarılması
          </h2>
          <p>
            Kişisel verileriniz, yukarıda belirtilen amaçlarla sınırlı olmak
            üzere konaklama tesisi ve etkinlik organizasyonunda görev alan
            üçüncü taraflarla paylaşılabilir. Verileriniz yurt dışında bulunan
            bulut hizmet sağlayıcıları aracılığıyla (Supabase Inc.) işlenebilir;
            bu durumda KVKK&apos;nın 9. maddesi kapsamında gerekli güvenlik
            önlemleri alınmaktadır.
          </p>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            5. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi
          </h2>
          <p>
            Kişisel verileriniz, platform üzerinden elektronik ortamda
            toplanmakta olup KVKK&apos;nın 5. maddesinin 2. fıkrasının (a)
            bendinde yer alan &quot;kanunlarda açıkça öngörülmesi&quot;, (c)
            bendinde yer alan &quot;bir sözleşmenin kurulması veya ifasıyla
            doğrudan ilgili olması&quot; ve (f) bendinde yer alan &quot;veri
            sorumlusunun meşru menfaatleri için zorunlu olması&quot; hukuki
            sebeplerine dayanılarak işlenmektedir.
          </p>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            6. Veri Sahibi Hakları
          </h2>
          <p>
            KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme</li>
            <li>
              İşlenme amacını ve bunların amacına uygun kullanılıp
              kullanılmadığını öğrenme
            </li>
            <li>
              Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
            </li>
            <li>
              Eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini
              isteme
            </li>
            <li>
              KVKK&apos;nın 7. maddesinde öngörülen şartlar çerçevesinde
              silinmesini veya yok edilmesini isteme
            </li>
            <li>
              İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz
              edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz
              etme
            </li>
            <li>
              Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde
              zararın giderilmesini talep etme
            </li>
          </ul>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            7. Veri Saklama Süresi
          </h2>
          <p>
            Kişisel verileriniz, etkinlik tarihinden itibaren en geç 6 (altı) ay
            içerisinde silinecek, yok edilecek veya anonim hâle getirilecektir.
          </p>
        </section>

        <section>
          <h2 className="t-sheet mb-2 text-[0.8125rem] text-ink">
            8. İletişim
          </h2>
          <p>
            Yukarıda belirtilen haklarınızı kullanmak için{" "}
            <a
              href="mailto:dokuzeylulrac@gmail.com"
              className="text-primary hover:underline"
            >
              dokuzeylulrac@gmail.com
            </a>{" "}
            adresine yazılı olarak başvurabilirsiniz.
          </p>
        </section>
      </div>

      <div className="text-center">
        <Link
          href="/kayit"
          className="t-note text-ink underline underline-offset-[5px]"
        >
          ← Kayıt sayfasına dön
        </Link>
      </div>
    </div>
  );
}
