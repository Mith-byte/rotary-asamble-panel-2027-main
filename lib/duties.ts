/**
 * Görev — the district's own duty list (Kayıtta Seçilecek Görev Çeşitleri 2027).
 *
 * The public site holds the same 26 entries in its own code and links in with
 * /kayit?gorev=<id>. The ids are contractual and ASCII; the database stores only
 * the id (profiles.gorev, constrained in 00003_profiles.sql), and labels live
 * here so both properties can be diffed against each other.
 *
 * Order and grouping are the district's. Do not invent options, do not reorder,
 * do not translate. A registration holds exactly one duty.
 */

export const DUTY_GROUPS = [
  { id: "kulup", label: "Kulüp", note: "Kulübü devralan kurul, komite başkanları ve kulüp üyeleri" },
  { id: "bolge", label: "Bölge", note: "Guvernörler, bölge görevlileri ve bölge komite üyeleri" },
  { id: "rotaract", label: "Rotaract", note: "Rotaractörler ve bölge Rotaract görevlileri" },
  { id: "interact", label: "Interact", note: "Interactörler ve bölge Interact görevlileri" },
  { id: "misafir", label: "Misafir", note: "Bir görevi olmadan katılanlar" },
] as const;

export type DutyGroupId = (typeof DUTY_GROUPS)[number]["id"];

export interface Duty {
  id: string;
  /** What the duty is called. Rendered on its own wherever space is tight. */
  label: string;
  /** The district's annotation on that post. Rendered beside the label, never merged into it. */
  term?: string;
  group: DutyGroupId;
}

export const DUTIES: readonly Duty[] = [
  // Kulüp
  { id: "baskan-2627", label: "Kulüp Başkanı", term: "2026–27 Dönemi", group: "kulup" },
  { id: "gecmis-baskan", label: "Geçmiş Dönem Başkanı", group: "kulup" },
  { id: "baskan-2728", label: "Gelecek Dönem Başkanı", term: "2027–28 Dönemi", group: "kulup" },
  { id: "sekreter", label: "Sekreter", term: "2027–28 Dönemi", group: "kulup" },
  { id: "sayman", label: "Sayman", term: "2027–28 Dönemi", group: "kulup" },
  { id: "vakif-komite-bsk", label: "Vakıf Komitesi Başkanı", term: "2027–28 Dönemi", group: "kulup" },
  { id: "uyelik-komite-bsk", label: "Üyelik Komite Başkanı", term: "2027–28 Dönemi", group: "kulup" },
  { id: "komite-bsk", label: "Komite Başkanı", term: "2027–28 Dönemi", group: "kulup" },
  { id: "uye", label: "Üye", group: "kulup" },

  // Bölge
  { id: "guvernor", label: "Dönem Guvernörü", group: "bolge" },
  { id: "gecmis-guvernor", label: "Geçmiş Dönem Guvernörü", group: "bolge" },
  { id: "gelecek-guvernor", label: "Gelecek Dönem Guvernörü", group: "bolge" },
  { id: "guvernor-adayi", label: "Gelecek Dönem Guvernör Adayı", group: "bolge" },
  { id: "bolge-gorevlisi", label: "Bölge Görevlisi", group: "bolge" },
  { id: "bolge-komite-uyesi", label: "Bölge Komite Üyesi", group: "bolge" },

  // Rotaract
  { id: "rotaractor", label: "Rotaractör", group: "rotaract" },
  { id: "brt", label: "Bölge Rotaract Temsilcisi", group: "rotaract" },
  { id: "brt-gelecek", label: "Gelecek Dönem Bölge Rotaract Temsilcisi", term: "2027–28", group: "rotaract" },
  { id: "brt-gecmis", label: "Geçmiş Dönem Bölge Rotaract Temsilcisi", group: "rotaract" },
  { id: "bolge-gorevlisi-rotaract", label: "Bölge Görevlisi (Rotaract)", group: "rotaract" },

  // Interact
  { id: "interactor", label: "Interactör", group: "interact" },
  { id: "bit", label: "Bölge Interact Temsilcisi", group: "interact" },
  { id: "bit-gelecek", label: "Gelecek Dönem Bölge Interact Temsilcisi", term: "2027–28", group: "interact" },
  { id: "bit-gecmis", label: "Geçmiş Dönem Bölge Interact Temsilcisi", group: "interact" },
  { id: "bolge-gorevlisi-interact", label: "Bölge Görevlisi (Interact)", group: "interact" },

  // Misafir
  { id: "misafir", label: "Misafir", group: "misafir" },
];

export const DUTY_IDS = DUTIES.map((d) => d.id);

const BY_ID = new Map(DUTIES.map((d) => [d.id, d]));

export function getDuty(id: string | null | undefined): Duty | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * An unknown id is not an error — it can arrive from a stale link — so this
 * returns null rather than throwing, and callers fall back to an unset field.
 */
export function dutyLabel(id: string | null | undefined): string | null {
  return getDuty(id)?.label ?? null;
}

/** Label plus the district's annotation, for anywhere with room for both. */
export function dutyLabelWithTerm(id: string | null | undefined): string | null {
  const duty = getDuty(id);
  if (!duty) return null;
  return duty.term ? `${duty.label} (${duty.term})` : duty.label;
}

export function dutiesByGroup(group: DutyGroupId): Duty[] {
  return DUTIES.filter((d) => d.group === group);
}
