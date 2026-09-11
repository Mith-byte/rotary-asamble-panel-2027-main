/**
 * The clubs a registrant can belong to, across the district's three bodies.
 *
 * profiles.club is contractual — the public site's roster reads it and
 * anonymises the registrant's name beside it — so the stored value is the full
 * club name exactly as written here.
 *
 * Which roster a registrant sees is decided by their görev: a Rotaractör picks
 * from Rotaract clubs, a club or district officer from Rotary clubs. That is
 * not a convenience, it is the only way the field can be correct — there is no
 * "Sekreter" of an Interact club in the Rotary roster.
 */

export type ClubType = "rotary" | "rotaract" | "interact";

/* ── Rotary ──────────────────────────────────────────────────────────────
   The district's own roster, in its own 15 groups.

   NOTE: the district's stated total is 73; these groups hold 71. Two clubs
   are missing and this is not the complete roster until that is reconciled. */
const ROTARY_GROUPS: Readonly<Record<number, readonly string[]>> = {
  1: ["Aydın", "Denizli", "Milet", "Pamukkale"],
  2: ["Bodrum", "Fethiye", "Karia", "Muğla Zeytin Dalı", "Marmaris", "Ölüdeniz"],
  3: ["Bandırma", "Çekirge", "Kuzey Yıldızı", "Muradiye", "Nilüfer"],
  4: ["Balıkesir", "Gökdere", "Heykel", "Özlüce", "Uludağ"],
  5: ["Bademli", "Bursa", "Çanakkale", "Demirtaş", "Tophane"],
  6: ["İnegöl", "Osmangazi", "Yeşil", "Yıldırım Bayezid"],
  7: ["Digiverse", "İyi Yaşam", "Naturel", "Toprak Ana"],
  8: ["Alsancak", "Çakabey", "Efes", "100.Yıl Güzelbahçe", "Salihli", "Kurumsal"],
  9: ["Çiğli", "Ege", "İzmir", "Phokaia", "Karabağlar Çalıkuşu"],
  10: ["Çeşme", "Güzelyalı", "Konak", "Varyant"],
  11: ["Agora", "Kültürpark", "Manisa", "Mavişehir", "Sahilevleri"],
  12: ["Bornova", "Bostanlı", "Gündoğdu", "Kuşadası Güvercinada", "Longevity Sağlıklı Yaşam"],
  13: ["Buca", "Rotary 2440. Bölge E-Kulübü", "Göztepe", "Kordon", "Urla"],
  14: ["Denizyıldızı", "Dokuz Eylül", "Karşıyaka", "Kuşadası", "Smyrna"],
  15: ["100. Yıl", "Fikir Sanat", "Kültürel Miras"],
};

/* ── Rotaract ────────────────────────────────────────────────────────────
   Carried over from the district's Rotaract roster. Not grouped: the district
   publishes group numbers for its Rotary clubs only. */
const ROTARACT_NAMES: readonly string[] = [
  "Agora", "Alsancak", "Bademli", "Balçova", "Balıkesir", "Bodrum", "Bornova",
  "Bostanlı", "Bursa", "Çalıkuşu", "Çekirge", "Çiğli", "Denizli", "Didim",
  "Dokuz Eylül", "Efes", "Ege", "Gökdere", "Göztepe", "Güzelbahçe", "Güzelyalı",
  "İnegöl", "İzmir Ekonomi", "İzmir", "Karşıyaka", "Konak", "Kordon", "Magnesia",
  "Mavişehir", "Muradiye", "Naturel", "Nilüfer", "Smyrna", "Tophane", "Urla",
];

/* ── Interact ────────────────────────────────────────────────────────────
   Interact clubs carry the same names as their Rotaract counterparts, so the
   roster is derived rather than duplicated — one list to correct when the
   district issues its own, and no chance of the two drifting apart.

   UNCONFIRMED: this mirroring was specified by the owner, not published by the
   district. If the district's Interact roster differs, replace this. */
const INTERACT_NAMES: readonly string[] = ROTARACT_NAMES;

/**
 * Already a complete club name — appending a suffix would produce
 * "Rotary 2440. Bölge E-Kulübü Rotary Kulübü".
 */
const FULL_NAME_EXEMPT = new Set(["Rotary 2440. Bölge E-Kulübü"]);

const SUFFIX: Record<ClubType, string> = {
  rotary: "Rotary Kulübü",
  rotaract: "Rotaract Kulübü",
  interact: "Interact Kulübü",
};

export interface Club {
  /** As the district writes it, without the suffix. */
  name: string;
  /** What is stored in profiles.club and shown to the registrant. */
  full: string;
  type: ClubType;
  /**
   * The district's group number, 1–15.
   *
   * ROTARY CLUBS ONLY — the district publishes groups for its Rotary roster and
   * for nothing else, so this is `undefined` on every Rotaract and Interact
   * club. Guard on `group !== undefined`, never on the club itself, or the two
   * other rosters render "undefined. grup".
   */
  group?: number;
}

function build(name: string, type: ClubType, group?: number): Club {
  return {
    name,
    full: FULL_NAME_EXEMPT.has(name) ? name : `${name} ${SUFFIX[type]}`,
    type,
    ...(group === undefined ? {} : { group }),
  };
}

export const CLUBS: readonly Club[] = [
  ...Object.entries(ROTARY_GROUPS).flatMap(([group, names]) =>
    names.map((n) => build(n, "rotary", Number(group))),
  ),
  ...ROTARACT_NAMES.map((n) => build(n, "rotaract")),
  ...INTERACT_NAMES.map((n) => build(n, "interact")),
];

/**
 * The host club, excluded from the public club roster and from the panel's
 * registrant counts.
 *
 * NAME NOT CONFIRMED: the brief calls the host "İzmir Dokuz Eylül Rotary
 * Kulübü"; the district's roster lists it in group 14 as plain "Dokuz Eylül".
 * The value below is what the picker stores, so it is what the exclusion has
 * to match — an exclusion that does not match exactly fails silently and puts
 * the host club back in the counts.
 */
export const HOST_CLUB = "Dokuz Eylül Rotary Kulübü";

const BY_FULL = new Map(CLUBS.map((c) => [c.full, c]));

export function getClub(value: string | null | undefined): Club | undefined {
  return value ? BY_FULL.get(value) : undefined;
}

export function isClub(value: string | null | undefined): boolean {
  return !!value && BY_FULL.has(value);
}

/* ── Which roster a görev may pick from ──────────────────────────────────
   Keyed on the duty's GROUP, not on individual duties: the five groups are
   exactly the bodies a registrant can belong to, which is what makes this a
   rule rather than a lookup table to maintain.

   Misafir attends without a post, so no roster can be ruled out for them. */
const ALL: readonly ClubType[] = ["rotary", "rotaract", "interact"];

const TYPES_BY_DUTY_GROUP: Record<string, readonly ClubType[]> = {
  kulup: ["rotary"],
  bolge: ["rotary"],
  rotaract: ["rotaract"],
  interact: ["interact"],
  misafir: ALL,
};

/**
 * The club types a duty may pick from. An unknown or unset görev returns every
 * roster — the field is not yet constrained, and showing nothing would be
 * worse than showing too much.
 */
export function clubTypesForDutyGroup(
  group: string | null | undefined,
): readonly ClubType[] {
  return (group && TYPES_BY_DUTY_GROUP[group]) || ALL;
}

/** The clubs a duty group may pick from, in roster order. */
export function clubsForDutyGroup(group: string | null | undefined): Club[] {
  const types = clubTypesForDutyGroup(group);
  return CLUBS.filter((c) => types.includes(c.type));
}

/** Whether a stored club is valid for the duty group held alongside it. */
export function isClubForDutyGroup(
  value: string | null | undefined,
  group: string | null | undefined,
): boolean {
  const club = getClub(value);
  return !!club && clubTypesForDutyGroup(group).includes(club.type);
}

export const CLUB_NAMES: readonly string[] = CLUBS.map((c) => c.full);
