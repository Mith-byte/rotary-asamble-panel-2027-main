import { PageHead, Room } from "@/components/plan/room";
import { Register, Row } from "@/components/plan/register";
import { event, formatDate } from "@/lib/event";

/*
  The programme has not been issued.

  The page it replaced carried the previous conference's schedule — three days
  in May 2026, several rooms, an after-party. None of that describes this
  assembly, and inventing a replacement would be worse than showing none. So
  the sheet is drawn the way a drawing set draws work that is not yet issued:
  dashed, hatched, stamped TASLAK. The four days and the one hall are facts we
  do have, so those are stated.
*/
const days = [
  { n: 1, date: "1 Nisan 2027", weekday: "Perşembe", note: "Tesise giriş" },
  { n: 2, date: "2 Nisan 2027", weekday: "Cuma", note: "Oturumlar" },
  { n: 3, date: "3 Nisan 2027", weekday: "Cumartesi", note: "Oturumlar" },
  { n: 4, date: "4 Nisan 2027", weekday: "Pazar", note: "Tesisten ayrılış" },
];

export default function TakvimPage() {
  return (
    <div className="space-y-7">
      <PageHead
        tag="Takvim"
        figure="4 GÜN"
        title="Program"
        lead={`Oturumların tamamı ${event.hall} salonunda yapılır. Paralel oturum yoktur — herkes aynı programı izler.`}
      />

      <Room className="p-4 md:p-6">
        <h2 className="t-sheet mb-3 text-[0.8125rem]">Asamble</h2>
        <Register>
          <Row label="Tarih">{event.dateLabel}</Row>
          <Row label="Tesis">{event.venue}</Row>
          <Row label="Şehir">{event.venueCity}</Row>
          <Row label="Salon">{event.hall}</Row>
        </Register>
      </Room>

      <Room draft className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="t-sheet text-[0.8125rem]">Günlük program</h2>
          <span className="stamp t-note">Taslak</span>
        </div>
        <p className="prose-measure mt-3 text-sm text-muted-foreground">
          Saatli program bölge tarafından henüz yayımlanmadı. Yayımlandığında bu
          sayfada görünecek ve size bildirilecek.
        </p>

        <ul className="mt-5">
          {days.map((day) => (
            <li
              key={day.n}
              className="flex items-baseline gap-4 border-b border-rule py-3 last:border-b-0"
            >
              <span className="t-data w-16 shrink-0 text-[0.8125rem] text-muted-foreground">
                {day.n}. gün
              </span>
              <span className="t-label flex-1 text-[0.9375rem]">
                {day.date}
                <span className="t-data ml-2 text-[0.6875rem] text-muted-foreground">
                  {day.weekday}
                </span>
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">{day.note}</span>
            </li>
          ))}
        </ul>
      </Room>

      <p className="t-note text-muted-foreground">
        Son güncelleme {formatDate(new Date())}
      </p>
    </div>
  );
}
