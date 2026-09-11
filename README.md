# rotary-asamble-2026-panel

Registration and administration platform for the UR 2440. Bölge Asamblesi.
Forked from [`konferans2026-platform`](https://github.com/andyanday33/konferans2026-platform);
the marketing site lives in `../rotary-asamble-2026`.

## Getting started

```bash
npm ci
cp .env.example .env.local   # fill in the new Supabase project's keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | browser + server |
| `SUPABASE_SECRET_KEY` | server only — never exposed to the browser |

## Commands

| Command | Does |
| --- | --- |
| `make dev` | Next dev server |
| `make build` / `make start` | production build and serve |
| `make lint` | ESLint |
| `make docker-up` / `make docker-down` | run via docker compose (port 3001) |

## Carried over from the fork

See `CLAUDE.md` for the full brief — event details, the integration contract with the
public site, the design system and the copy rules. These still point at the conference
event and need updating for the assembly:

- Cookie domain `konferanszamancarklari.com` in `lib/supabase/{client,server,middleware}.ts`
- Site metadata in `app/layout.tsx`
- Header/footer branding and logo links in `app/(user)`, `app/(admin)`, `app/(auth)`, `components/app-sidebar.tsx`
- Copy in `app/(auth)/kvkk/page.tsx` and `app/(user)/takvim/page.tsx`
- `supabase/` migrations — schema is conference-shaped
