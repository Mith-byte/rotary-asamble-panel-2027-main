# Project Memory

## Overview
- **Project**: Kayıt Paneli — registration/admin panel for the UR 2440. Bölge Asamblesi
- **Stack**: Next.js 16.1.6 (App Router), React 19.2.3, Tailwind CSS v4, TypeScript 5, Supabase, shadcn/ui
- **Language**: Turkish throughout. Keep `lang="tr"` and `latin-ext` font subsets (ğ ş ı İ ç ö ü) — a missing subset breaks the copy visibly.
- **Sibling**: the public marketing site is `../rotary-asamble-2026`. It links *into* this panel.
- **Origin**: forked from `konferans2026-platform` (the "Zaman Çarkları" conference). Only the
  Supabase registration plumbing is meant to survive; the conference branding is not.
- **Source of truth**: the owner's briefing document, whose §2–§4 (query-string contract) and §5
  (shared data) are the two seams between this panel and the public site. Anything in those two
  areas that needs to change — **say so before changing it**.

## The event
- 2027–28 Dönemi Bölge Asamblesi · 1–4 Nisan 2027 · Beks Premium Resort & Spa, Kuşadası
- Sessions run in the **Magnesia** hall. Host club: İzmir Dokuz Eylül Rotary Kulübü.
- District line for the term: **Hayalleri İnşa Ediyoruz**. Officers take office **1 Temmuz 2027**.
  The term is **2027–28** — any "2026–27" in this repo is stale.
- A district assembly is not a conference. Users are adults doing a required job, often on a phone,
  often in a hurry. Institutional and practical, never celebratory.
- **They are not only club officers.** The duty list includes guvernörler, bölge görevlileri,
  Rotaract/Interact temsilcileri, ordinary members and guests. Never write copy that assumes a
  club post.
- **One hall, one schedule.** No tracks, no parallel salons, no per-duty sessions. Everyone sits in
  Magnesia for all four days.
- The public site's job ends at "this person wants to register, with this duty". **This panel's job
  starts one click later: complete that intent without making them re-decide anything.**

## Integration contract with the public site
The site links in with parameters already filled. Honour them or the funnel breaks.

| From | URL | Expected |
| --- | --- | --- |
| Header "Giriş", footer "Kayıt platformu" | `/` | Normal sign-in |
| Görev legend CTA | `/kayit?gorev=<DutyId>` | Registration with that duty preselected |
| Görev legend CTA, nothing picked | `/kayit` | Registration, nothing preselected |
| Paket CTA | `/kayit?paket=<PackageId>&gorev=<DutyId>` | Preselect **both** package and duty |

`gorev` is omitted entirely when the visitor picked no duty. `paket` is always present on a package
CTA. Both values are **fixed ASCII strings** (below), stable, and never changed without notice.

- An unknown or missing parameter is **not an error**. Fall back to an unset field. Never show a
  validation error for something the user did not type.
- A preselected value is announced, not locked: "Görev, geldiğiniz bağlantıdan seçildi. Değiştirebilirsiniz."
- **Never drop the other parameter when the user changes one.** Arriving with a duty and switching
  package keeps the duty.
- Public-site anchors, if linking back: `#anasayfa` `#hakkinda` `#gorev` `#program` `#otel`
  `#paketler` `#kulupler` `#sss`.

## The 26 duties (`gorev`)
The district's own list, in the district's own order and grouping. **Offer exactly this list,
grouped exactly this way.** Do not invent, reorder or translate. A registration holds **one duty**
— not a scheduling constraint, just what the record says.

**Kulüp** — *Kulübü devralan kurul, komite başkanları ve kulüp üyeleri*
```
baskan-2627         Kulüp Başkanı (2026–27 Dönemi)
gecmis-baskan       Geçmiş Dönem Başkanı
baskan-2728         Gelecek Dönem Başkanı (2027–28 Dönemi)
sekreter            Sekreter (2027–28 Dönemi)
sayman              Sayman (2027–28 Dönemi)
vakif-komite-bsk    Vakıf Komitesi Başkanı (2027–28 Dönemi)
uyelik-komite-bsk   Üyelik Komite Başkanı (2027–28 Dönemi)
komite-bsk          Komite Başkanı (2027–28 Dönemi)
uye                 Üye
```
**Bölge** — *Guvernörler, bölge görevlileri ve bölge komite üyeleri*
```
guvernor            Dönem Guvernörü
gecmis-guvernor     Geçmiş Dönem Guvernörü
gelecek-guvernor    Gelecek Dönem Guvernörü
guvernor-adayi      Gelecek Dönem Guvernör Adayı
bolge-gorevlisi     Bölge Görevlisi
bolge-komite-uyesi  Bölge Komite Üyesi
```
**Rotaract** — *Rotaractörler ve bölge Rotaract görevlileri*
```
rotaractor                 Rotaractör
brt                        Bölge Rotaract Temsilcisi
brt-gelecek                Gelecek Dönem Bölge Rotaract Temsilcisi (2027–28)
brt-gecmis                 Geçmiş Dönem Bölge Rotaract Temsilcisi
bolge-gorevlisi-rotaract   Bölge Görevlisi (Rotaract)
```
**Interact** — *Interactörler ve bölge Interact görevlileri*
```
interactor                 Interactör
bit                        Bölge Interact Temsilcisi
bit-gelecek                Gelecek Dönem Bölge Interact Temsilcisi (2027–28)
bit-gecmis                 Geçmiş Dönem Bölge Interact Temsilcisi
bolge-gorevlisi-interact   Bölge Görevlisi (Interact)
```
**Misafir** — *Bir görevi olmadan katılanlar*
```
misafir             Misafir
```

- The parenthesised term is the district's annotation, not part of the label. **Store the id;
  render label + term.**
- **No per-duty training tracks.** An earlier version of this project invented eight
  (BŞK / SEK / SAY / …). Any such track anywhere in this repo is dead code.
- **No per-duty colour coding.** A duty is an *address*, not a category needing a hue. The five
  group headings carry the taxonomy and must always be visible.
- The list is long: group it under the five headings and make it type-to-filter.
- Keep the site's guidance for an unlisted post: *Komite Başkanı* for any committee chair, *Üye*
  for a member without a post, *Misafir* for a non-Rotarian.

## The nine packages (`paket`)
Nine fixed ASCII ids. **A UUID will never arrive in the URL.** Key the `packages` table on these
ids (or carry them in a `slug` column and resolve). Three axes only — konaklama, tören, gala.

| `paket` | Name (district's own) | Group | Kişi | Gece | Tören | Gala |
| --- | --- | --- | --- | --- | --- | --- |
| `1k-3g` | 1 Kişi • 3 Gece Konaklama | konaklamalı | 1 | 3 | ✓ | ✓ |
| `2k-3g` | 2 Kişi • 3 Gece Konaklama | konaklamalı | 2 | 3 | ✓ | ✓ |
| `3k-3g` | 3 Kişi • 3 Gece Konaklama | konaklamalı | 3 | 3 | ✓ | ✓ |
| `1k-2g` | 1 Kişi • 2 Gece Konaklama | konaklamalı | 1 | 2 | ✓ | ✓ |
| `2k-2g` | 2 Kişi • 2 Gece Konaklama | konaklamalı | 2 | 2 | ✓ | ✓ |
| `3k-2g` | 3 Kişi • 2 Gece Konaklama | konaklamalı | 3 | 2 | ✓ | ✓ |
| `gala-toren` | Gala + Tören • Konaklama Hariç | konaklamasız | 1 | 0 | ✓ | ✓ |
| `toren` | Tören • Konaklama ve Gala Hariç | konaklamasız | 1 | 0 | ✓ | — |
| `gala` | Gala • Konaklama ve Tören Hariç | konaklamasız | 1 | 0 | — | ✓ |

- That order is the public site's: **nights-major**, so the six konaklamalı packages read as a
  3 × 2 matrix (1/2/3 kişi across, 3 gece then 2 gece down). Keep it — the order *is* the
  comparison the user is making.
- Names are the district's and appear verbatim on both properties. **Do not rename, shorten or
  prettify them.**
- **Draw the exclusions, not just the inclusions.** Three packages are defined by what they omit.
  Render all three slots for every package and show a missing one as an explicit *"Gala yok"* —
  otherwise `toren` and `gala-toren` look identical until you read the name closely.
- **`Kişi` is a room's occupancy, not a registration headcount.** Do not assume `3k-2g` means three
  registrants — that is an open question.
- **Prices are not issued.** No package carries a figure. Say so once, plainly
  (*"Ücretler açıklanmadı"*), and render no price block. Never invent a number, and never build a
  UI that cannot render a priceless package.
- A `konaklamasız` package carries no room. Do not ask a room question for one.

## Shared database shapes
**The public site reads exactly two tables.** It breaks silently if these columns are renamed or
dropped:

```
profiles         first_name, last_name, club, status ("accepted" | "waiting")
pricing_periods  id ("early_bird" | "round_1" | "round_2"), label, starts_at, ends_at
```

- `pricing_periods` drives the site's "Kayıt dönemleri" bar: the active window is the row whose
  `starts_at`/`ends_at` contains `now`. Keep the windows **contiguous and non-overlapping** — a gap
  shows no active period, an overlap picks the first match. Public labels: *Erken kayıt*,
  *1. dönem*, *2. dönem*; erken kayıt is the lowest price.
- When packages move into the database the site will want this shape:
  ```
  packages   id (one of the nine ids above), name, group,
             capacity, nights, ceremony, gala,
             early_bird_price, early_bird_installment_price,
             round_1_price,    round_1_installment_price,
             round_2_price,    round_2_installment_price
  ```
  Price columns must be **nullable** — no figure has been issued. The table also carries a
  panel-owned `sort_order` (the nights-major order), because null prices cannot order the list.
  Additive, so it does not touch the seam — but the site holds the same order in code, and the
  two must not disagree.
- `profiles` feeds the public club roster, which anonymises to `Be*** An***`, shows only `accepted`
  and `waiting`, and excludes the host club. This panel is authenticated and may show full names to
  the person themselves and to district staff — but **never build a public-facing list of full names**.

## Design system — "Plan Görünüşü" (the brief)
A plan drawing, but not a plan *of* anything: no map, no floor plan. The drawing language is the
layout system, and every device does real information work. If something is there only for the
look, cut it.

```
--paper        #EFEDE6   page ground: gridded plan paper
--sheet        #F7F5EF   opaque panels: forms, tables, cards
--ink          #12233F   ALL type, walls, rules, borders, primary buttons
--gold         #F0A500   the one accent
--rule         #A9A79E   hairlines
--rule-strong  #7C7A70   secondary borders
--muted        #6B6A61   secondary type (clears 4.5:1 on paper)
```

Ruled ground — 12 / 96px module:

```css
body {
  background-color: #efede6;
  background-image:
    linear-gradient(to right,  #dcd8cb 1px, transparent 1px),
    linear-gradient(to bottom, #dcd8cb 1px, transparent 1px),
    linear-gradient(to right,  #e6e3d9 1px, transparent 1px),
    linear-gradient(to bottom, #e6e3d9 1px, transparent 1px);
  background-size: 96px 96px, 96px 96px, 12px 12px, 12px 12px;
}
```

**Walls.** A wall in plan is **two hairlines with a gap**, never one thick rule. That one idea
carries the identity.

```css
/* An opaque panel, walled. The default container. */
.room {
  background: #f7f5ef;
  border: 1px solid #12233f;
  box-shadow: inset 0 0 0 3px #f7f5ef, inset 0 0 0 4px #12233f;
  padding: 4px;                 /* content clears the inner line */
}
/* Poché: solid ink fill. Header, footer, any solid bar. */
.poche { background: #12233f; color: #efede6; }
```

Panels are opaque and hide the grid. Forms and tables sit in rooms; prose sits directly on the
ruled ground. Border radius is `0` everywhere. **No shadows** — the inset rings are walls, not depth.

**Two marks.** **Poché** (solid ink) means *this is the current one* — the open step, the selected
tab, the active row. **Gold** means *this one is yours* — the choice the user made. Something that
is both carries both, and that is the only place gold appears.

```css
.duty[data-pick="true"]       { background: #12233f; color: #efede6; }
.duty[data-pick="true"] .mark { background: #f0a500; border-color: #f0a500; }
```

- **Gold marks a user choice and nothing else.** A gold "open now" badge or a gold primary button is
  a bug — those are poché. Gold on a screen should be countable on one hand.
- Gold is a **fill, never a text colour** (ink on gold clears 7.6:1; gold on paper does not).
- No blue "info", no green success. Ink carries every neutral UI state. If an error colour is
  needed, **ask** — do not invent one.

**The one place colour is allowed: package chips.** Three pencils, confined to the attribute chips
on a package.

```
--pencil-stay  #2C6491   konaklama
--pencil-rite  #A8323C   tören
--pencil-gala  #1F6F62   gala
```

A chip is one line of a material key: a hatched swatch and its name. **The hatch does the work and
the colour confirms it** — diagonal for konaklama, cross-hatch for tören, stipple for gala — so the
coding survives a monochrome print and a reader who cannot separate the hues. Colour never touches
the label; chip text is ink. A **void chip** (the slot a package does not carry) is dashed,
unhatched, unfilled.

**A pencil used anywhere but a package chip is a bug.** They are pencils, not brand colours, and
they do not extend to duties — duties have no colour coding.

**Type** — all three from Google Fonts with `subsets: ["latin", "latin-ext"]`:

| Family | Role |
| --- | --- |
| Archivo | Display. Variable `wdth`, set **WIDE** (110–115) and tracked, uppercase. |
| Source Serif 4 | Body. Variable — long Turkish text, help copy. |
| IBM Plex Mono | Data. Times, dates, prices, IDs, counts — and field labels (`.t-note`), because a label is an annotation. |

A drawing sheet has no headline: display type carries presence by extending **horizontally**, never
by getting tall. Nothing above ~3.5rem. Mono is for data that *really is* tabular — not prose, not
buttons that are really sentences.

**Reuse:** rooms (the walled panel) · room tag (a boxed label carrying a real figure,
`KAYDINIZ · 1 GÖREV`, never a decorative `01 / 02`) · title block (field grid, label above value —
good for an order summary) · register rows (label left, value right, hairline between) · package
chips including the void chip, anywhere a package is summarised · "not yet issued" (dashed border,
45° hatch, small `TASLAK` stamp) for anything provisional · grid bubble (a hairline circle, empty
until picked then gold — round because a square promises multi-select).

```css
.mark { width:.8125rem; height:.8125rem; border:1px solid #12233f;
        border-radius:50%; }   /* the only curve; boxes stay radius 0 */
```

**Do not port:** the exterior walls, windows and door swings (the marketing site's signature) ·
plan furniture in the margin · the hero artwork. Motion is CSS only, under 200ms, state feedback
only — there is no animation library on either property.

## Design system — as built
The brief's "Plan Görünüşü" is implemented in `app/globals.css` and
`components/plan/*`. The public site is the *drawing* — a plan bounded by exterior walls, glazed,
with door swings. **This panel is the other half of a drawing set: the title block**, the corner
panel that states whose sheet it is, what it covers and what has not been issued. That is what a
registration record is, so the shell is drawn as one.

- **`components/plan/`** holds every reusable device: `Room` / `RoomTag` / `PageHead`,
  `Register` + `Row`, `DutyPicker`, `PackagePicker`, `PackageChips` + `PriceNotIssued`,
  `Dimension`, `StateBadge`, `Empty`, `ClubSelect`, `PhoneInput`, `DistrictMark`.
- **`Room` takes `className` for the CONTENT and `frameClassName` for the frame.** `.room` draws its
  second wall line with an inset ring, so a padding utility on the frame collapses the gap and the
  content lands on the wall. This is the one easy way to break the device.
- **The sidebar is the title block** (`app-sidebar.tsx`, `admin-sidebar.tsx`): poché-ruled, fields
  first (`tb-field` / `tb-label` / `tb-value`), navigation under them. The active page is filled
  with paper — the inverse of a poché'd picker row, same rule either way: filled means current.
  The old collapse toggle is gone; a title block that collapses to icons is not one.
- **Gold appears in exactly two places**: a picked bubble, and the Rotary wheel inside the mark.
  `.pick[data-pick="true"] .mark` is the only gold the interface draws.
- **The mark** is in `public/`: `rotary-2440.png` (blue wordmark + gold wheel) for paper grounds,
  `rotary-2440-on-ink.png` (white wordmark) for poché, plus `-white` and `-mono` variants unused so
  far. `DistrictMark` picks by `ground`, never by preference. `app/icon.png` is the district
  pinwheel, matching the public site.
- **Ink carries every state.** `StateBadge` separates accepted from waiting by *fill* (poché vs
  dashed), not by hue. The only non-palette colour in the CSS is `--destructive: #8d2731`, used for
  destructive confirmation only — flagged in the file, since the brief reserves error colour to ask
  about.
- `.t-note` labels a field or tags a room, and a room tag's figure must be a real count
  (`26 GÖREV`, `4 GÜN`, `2/3 ONAYLI`). It is never an eyebrow above a heading, and there are no
  decorative `01 / 02 / 03` markers — the only numbering is the signup stepper, which is a real
  sequence.

**Verified in the browser, not assumed:** the görev picker is one `<fieldset>` with 26 radios;
Tab reaches the group once and ArrowDown moves the selection (`sekreter` → `vakif-komite-bsk`),
updating React state; `:focus-visible` puts a 2px ring on the bubble, flipping to paper on a
poché'd row. Layout checked at a true 390px viewport via an iframe — window resizing on macOS
stops around 400px and reports the wrong width, exactly as the brief warns.

### Where the design answers missing data
Three screens had to say "not issued" rather than invent content. All three use the same device —
dashed border, 45° hatch, `TASLAK` stamp:
- **Payment.** No package has a price, so there is nothing to transfer and nothing to prove. When
  the selected package has no price for the active period, the payment block renders as draft and
  **the dekont is not required**; `/api/complete-profile` accepts a null `dekontPath`. When prices
  land, both revert automatically — no flag to flip.
- **Takvim.** The page carried the previous conference's three-day May 2026 schedule. It now states
  the four days and the one hall (facts we have) and draws the hourly programme as unissued.
- **KVKK.** Legal text naming the previous event's data controller. Restyled but **not rewritten** —
  marked as unissued instead, because a legal notice that looks finished but names the wrong
  organisation is worse than one that says it is pending.

## Writing
Institutional, practical, never celebratory. Formal *siz*. Sentence case. Plain verbs.

- Name things by what the user controls: **Görev**, **Paket**, **Kulüp** — not `duty_id`, `package`, `org`.
- An action keeps its name through the whole flow. *Kayıt ol* produces *Kaydınız alındı*. Never *Gönder*.
- Errors say what happened and how to fix it, in the interface's voice; they do not apologise and are
  never vague. "Bu e-posta ile bir kayıt var. Giriş yapın veya şifrenizi sıfırlayın." — not "Bir hata oluştu."
- Empty screens invite action, not mood: "Henüz kaydınız yok. Görevinizi seçerek başlayın."
- One job per element. A label labels; an example demonstrates; nothing does both.

**Sözlük** — match the public site exactly:

| Concept | Word |
| --- | --- |
| The event | Bölge Asamblesi |
| The term | 2027–28 dönemi |
| The post you register for | Görev |
| A duty group | Grup (Kulüp / Bölge / Rotaract / Interact / Misafir) |
| Registration package | Paket |
| Package group | Konaklamalı / Konaklamasız |
| Pricing window | Kayıt dönemi — Erken kayıt / 1. dönem / 2. dönem |
| The hall | Salon (Magnesia) |
| The venue | Tesis |
| A price not yet set | Ücretler açıklanmadı |

## Quality floor
Non-negotiable, matching the public site.

- Responsive to **390px**. Verify with real device emulation — a desktop window will not go narrow
  enough on macOS and will lie to you, in both directions.
- Visible keyboard focus: `2px solid #12233F`, `outline-offset: 3px`. On ink surfaces switch the
  ring to `#EFEDE6`.
- Respect `prefers-reduced-motion: reduce`.
- **The görev picker is a real radio group**: one `<fieldset>`, 26 `<input type="radio">` sharing a
  name, `sr-only` and styled through their labels. Not divs, not `aria-pressed` buttons — you hold
  one duty, so the control must give arrow-key traversal and "1 of 26" for free. Focus ring goes on
  the bubble (`input:focus-visible + .mark`). Radios do not uncheck on a second click, so offer an
  explicit **Seçimi kaldır**. Same for the paket picker.
- Real `aria-expanded` / `aria-live` on interactive pieces.
- Every data-fed view has a real empty state. The panel must look finished before the first
  registration exists.
- `tr-TR` locale for dates and numbers; `Europe/Istanbul` for anything with a time.

## Open items
District decisions. **Do not resolve them by guessing in code.**
- **Prices.** Not issued for any of the nine packages. Both properties must render a priceless
  package without looking broken.
- **Is a package price per person or per room?** The site's *"kişi başı"* / *"N kişi için"* is a
  placeholder reading, not a confirmed model.
- **Which two nights does a `2 gece` package cover?** The event is 1–4 Nisan — three nights. Nobody
  has said whether a two-night package drops the first or the last, or whether the registrant picks.
  If they pick, that is a field this panel needs and the public site does not have.
- **Does a multi-occupancy package register one person or several?** If several, companion names are
  needed and the public roster count changes meaning.
- **Do the six konaklamalı packages include tören and gala?** Both properties assume yes, inferred
  from the three konaklamasız packages being named by exclusion. An inference, not a statement.
- **Two clubs are missing from the roster.** `lib/clubs.ts` holds the district's Rotary clubs in
  their own 15 groups, replacing the inherited 35 Rotaract clubs. The 15 groups as issued sum to
  **71**; the district's own count is **73**. Do not treat the list as complete until that is
  reconciled.
- **The Interact roster is derived, not issued.** `lib/clubs.ts` carries three rosters — 71 Rotary
  clubs in their 15 groups, 35 Rotaract clubs, and 35 Interact clubs built from the *same names* as
  the Rotaract ones, per the owner. If the district's real Interact roster differs, replace
  `INTERACT_NAMES`; everything else follows from it.
- **The domain.** `konferanszamancarklari.com` and its `platform.` subdomain carry the previous
  event's name, hardcoded as a cookie domain in `lib/supabase/{client,server,middleware}.ts` and as
  a link target in six components. Both properties need the new domain at the same time.
- **Venue photos** on the public site came from bekshotels.com and are not cleared.

Resolved since the last revision: the district mark exists as a real asset (four-stroke pinwheel
over setting-out geometry) and is in use on the public site; package names are the district's own
and no longer carry the old conference theme.

## Schema (rewritten, verified, not yet applied)
`supabase/migrations` was collapsed from nine files into six. The old set could never bootstrap a
database — `00001` referenced `packages` and `pricing_type`, both created in `00003` — and it had
never been applied to this project, so it was rewritten rather than patched forward.

```
00001_types.sql         all enums + the shared updated_at trigger function
00002_packages.sql      packages (nine contractual ids, seeded, priceless) + pricing_periods
00003_profiles.sql      profiles incl. gorev + package_id, signup trigger, RLS
00004_installments.sql  taksitler
00005_rooms.sql         rooms, profiles.room_id, room_invitations
00006_storage.sql       the "dekontlar" storage bucket + its policies
```

- `packages.id` is **text**, constrained to the nine ASCII ids, and the nine rows are seeded by the
  migration — they are district-issued reference data, not seed-script data. All six price columns
  are **nullable**; nothing may assume a figure is present.
- `packages` carries a panel-owned `sort_order` holding the nights-major order. It exists because
  prices are null and can no longer order the list; the old code ordered packages by
  `early_bird_price`. Additive — it renames and drops nothing the public site reads.
- `"group"` is a reserved word and is quoted in SQL. The name is contractual, so it stays.
- `profiles.gorev` is text with a check constraint over the 26 ids, nullable, indexed. Labels,
  group headings and display order belong in code beside the list, mirroring the public site — the
  id is all the database holds.
- `pricing_periods` is created **empty**. The district has not issued registration dates and
  inventing them would put a wrong window on the public site. Note that `lib/actions/auth.ts`
  refuses signup while no period is active, so **signup stays closed until real dates are inserted**.
- Verified by applying all six in order under PGlite against stubbed `auth`/`storage` schemas: the
  set applies clean, the signup trigger creates the profile row, all 26 duty ids are accepted, and
  `BSK` (the invented eight-post scheme) and a uuid `package_id` are both rejected.
- `lib/clubs.ts` holds the district's Rotary clubs with their group number, and derives the stored
  value by appending "Rotary Kulübü" — one club, `Rotary 2440. Bölge E-Kulübü`, already carries a
  complete name and is exempt. `profiles.club` stores the full name, which is what the public site's
  roster reads, so the two must agree character for character.
- **The club roster follows the görev.** `clubsForDutyGroup()` keys on the duty's *group*, not on
  individual duties, because the five groups are exactly the bodies a registrant can belong to:
  `kulup`/`bolge` → Rotary, `rotaract` → Rotaract, `interact` → Interact, `misafir` → all three.
  An unset or unknown görev returns every roster rather than none. `ClubSelect` takes the `gorev`
  and says which list it opened; changing the görev clears a club that is no longer offered, and
  `/api/complete-profile` rejects a mismatched pairing outright — a Rotaract club under a district
  görev would reach the public roster and misdescribe the registrant.
- `HOST_CLUB` in `lib/clubs.ts` is the single definition of the club excluded from the roster and
  from registrant counts. It was hardcoded as `"Dokuz Eylül Rotaract Kulübü"` in four queries, a
  string no club in the new roster can match — the exclusion would have failed silently and put the
  host club back in the counts. **Its name is unconfirmed**: the brief says "İzmir Dokuz Eylül
  Rotary Kulübü", the roster says "Dokuz Eylül".
- `lib/duties.ts` holds the 26 duties with their labels, the district's annotations and the five
  group headings — the mirror of what the public site keeps in its own code. Cross-checked against
  the check constraint: 26 ids both ways, 9 / 6 / 5 / 5 / 1 per group. **Render a label, never the
  stored id** — `dutyLabel` for tight space, `dutyLabelWithTerm` where the annotation fits, both
  returning null for an unknown id rather than throwing, since a stale link is not an error.

## Inherited-code state
- **The görev picker does not exist yet.** The column, the constraint and `lib/duties.ts` are in
  place, and `/api/complete-profile` accepts and validates a `gorev`, but no form field offers the
  26 and no `?gorev=` / `?paket=` param handling exists — `signup-form.tsx` reads neither. Görev is
  therefore still optional server-side; **make it required once the picker lands**.
- **`member_type` is gone, deliberately.** The fork carried an eleven-value enum (Başkan, Asbaşkan,
  … , `'Rotary'`, `'Interact'`) — the last two are organisations, not membership types. It was
  Rotaract-conference shaped: *your post in your Rotaract club, or the other body you came from*.
  Nine of its eleven values duplicate a duty, so keeping both asked the registrant the same
  question twice. Görev is the field. If the district ever wants club standing separately, it needs
  their own list, not the inherited one.
- **The package UI cannot render a priceless package.** The `Package` interface in
  `signup-form.tsx`, `profil-tamamla/page.tsx` and `(user)/page.tsx` still types every price as
  `number`, and the price rendering has no null branch. This is the first thing the UI pass must
  fix — the database now returns nulls.
- `dekontlar` is a **storage bucket**, not a table: the code reaches it with
  `supabase.storage.from("dekontlar")` and every object is keyed `<user_id>/...`. It had no
  migration behind it until `00006`.
- `app/layout.tsx` sets `className="dark"` and reads "Konferans 2026". `app/globals.css` loads
  Oxanium + Rajdhani over a neon-cyan dark theme with `futuristic-card-*` utilities. None of the
  three briefed fonts is loaded anywhere.
- `app/(auth)/kvkk/page.tsx` names **Dokuz Eylül Rotaract Kulübü** as the data controller. That is
  legal copy naming the wrong organisation; it needs the district's wording, not a find-and-replace.
- Conference copy and links remain in `app/(user)`, `app/(admin)`, `app/(auth)/kvkk`,
  `app/(auth)/kayit`, `app/(user)/takvim` and `components/app-sidebar.tsx`.
- `app/(user)/oda-planlama` and the `rooms` / `room_invitations` tables implement peer room
  invitations. Whether that survives depends on the multi-occupancy open question above.
