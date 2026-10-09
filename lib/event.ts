/**
 * What the panel says about the event. Mirrors ../rotary-asamble-2026/lib/data.ts
 * so the two properties never disagree on a date, a venue or the term.
 */
export const event = {
  district: "UR 2440. Bölge",
  term: "2027–28",
  name: "Bölge Asamblesi",
  theme: "Hayalleri İnşa Ediyoruz",
  startsAt: "2027-04-01T14:00:00+03:00",
  endsAt: "2027-04-04T12:00:00+03:00",
  dateLabel: "2-4 Nisan 2027",
  venue: "Beks Premium Resort & Spa",
  venueCity: "Kuşadası, Aydın",
  /** Everyone sits in the same hall — there are no tracks and no parallel salons. */
  hall: "Magnesia",
  host: "İzmir Dokuz Eylül Rotary Kulübü",
  siteUrl: "https://asamble2440.com",
} as const;

/** tr-TR, Europe/Istanbul — for anything with a time. */
export function formatDate(value: string | Date, withTime = false): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Istanbul",
  }).format(d);
}

/** Whole days from now until the assembly opens. Negative once it has begun. */
export function daysUntilAssembly(now: Date = new Date()): number {
  const start = new Date(event.startsAt).getTime();
  return Math.ceil((start - now.getTime()) / 86_400_000);
}
