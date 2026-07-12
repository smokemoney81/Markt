# CLAUDE.md

Leitfaden für Claude Code (und andere KI-Agenten) in diesem Repository.
Sprache im Projekt: **Deutsch** (UI-Texte, Kommentare, Commit-Messages, Doku).

## Was ist dieses Projekt?

**Markt Dashboard** – eine mobile-first **PWA** für Selbstständige zum Verwalten
von Anzeigen (z. B. markt.de), Kontakten/CRM, Terminen, Finanzen und Medien.
Alle Daten sind pro Nutzer über **Supabase Row Level Security** abgesichert.

Zusätzlich enthält das Repo zwei eigenständige Bausteine:

1. **Münz-Meister** (`/spiel`) – ein Coin-Master-Klon als kleines Casual-Spiel
   im Dashboard. Wichtig: **reiner Client-Prototyp**, Spielstand liegt in
   `localStorage` (`coinmaster_save_v1`). Kein Server, keine Supabase-Persistenz,
   keine serverseitige Autorität, keine Käufe.
2. **local-llm** (`local-llm/`) – ein separates Python-Tool zum lokalen
   Ausführen von LLMs (llama.cpp). Unabhängig von der Next.js-App.

## Tech-Stack

- **Next.js 14** (App Router) + **TypeScript** (strict, `@/*` → `src/*`)
- **Tailwind CSS** – mobile-first, dunkles Design, Marken-Akzent `brand`
- **Supabase** – Postgres, Auth, Storage, RLS (`@supabase/ssr`)
- **PWA** – Service Worker (`public/`), installierbar
- **Deployment:** Vercel
- **Icons:** `lucide-react`, **Datum:** `date-fns`

## Befehle

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # Produktions-Build (nutze diesen zum Verifizieren)
npm run lint    # next lint / ESLint
```

Es gibt **kein** Test-Setup (kein Jest/Vitest, kein `npm test`). Änderungen mit
`npm run build` + `npm run lint` prüfen. Für UI-Änderungen die betroffene Seite
im Dev-Server ansehen.

## Projektstruktur

```
src/
  app/
    (app)/            # eingeloggter Bereich (BottomNav, Layout)
      page.tsx        # Start / Übersicht
      anzeigen/       # Anzeigen-Verwaltung
      kontakte/       # Kunden-CRM
      termine/        # Buchungskalender
      finanzen/       # Einnahmen/Ausgaben
      medien/         # Foto-/Video-Manager (Supabase Storage)
      spiel/          # Münz-Meister (Coin-Master-Klon)
    login/            # Auth-Seite (Registrieren/Login)
    layout.tsx        # Root-Layout, Service-Worker-Registrierung
  components/
    game/CoinMasterGame.tsx   # Spiel-UI (Client-Component)
    BottomNav.tsx, PageHeader.tsx, ui.tsx, ...
  lib/
    supabase/         # client.ts, server.ts, middleware.ts (SSR-Clients)
    game/coinmaster.ts        # Spiel-Logik & Balancing (pure functions)
    types.ts, format.ts, useTable.ts
supabase/migrations/0001_init.sql   # Schema + RLS + Storage-Bucket
public/                             # PWA-Manifest, Icons, Service Worker
middleware.ts                       # Supabase Session-Refresh
local-llm/                          # separates Python-LLM-Tool
```

## Datenmodell (Supabase)

Definiert in `supabase/migrations/0001_init.sql`. Tabellen: `ads`, `contacts`,
`appointments`, `transactions`, `media`, `services`. **Jede** Tabelle hat
`user_id → auth.users` und vier RLS-Policies (select/insert/update/delete auf
`auth.uid() = user_id`). Fotos/Videos liegen im privaten Storage-Bucket `media`.

**Regel:** Neue nutzerbezogene Tabellen bekommen immer `user_id` + die vier
RLS-Policies. Nie eine Tabelle ohne RLS anlegen.

## Das Spiel (Münz-Meister)

- **Balancing & Regeln:** zentral in `src/lib/game/coinmaster.ts`
  (`OUTCOME_WEIGHTS`, `itemCost`, `chestCost`, Regeneration, Tagesbonus, Karten).
  Änderungen an der Ökonomie **immer hier**, nicht in der UI.
- **UI/State:** `src/components/game/CoinMasterGame.tsx` (Client-Component),
  Persistenz nur `localStorage`.
- Logik ist als **pure functions** gehalten (gut testbar/anpassbar). Bei
  Balancing-Änderungen kurz die Auswirkung auf die Coin-Kurve mitdenken.

## Hinweis zu den hochgeladenen Design-Dokumenten

Die Konzept-/Roadmap-Dateien (Unity-Client + Node.js/Express + PostgreSQL +
Firebase Auth + serverseitiges Anti-Cheat + IAP) beschreiben eine **andere,
größere Zielarchitektur**, die in **diesem** Repo **nicht** existiert. Der
tatsächliche Stack ist Next.js + Supabase; das Spiel ist ein Client-Prototyp.
Wenn du an der Roadmap arbeitest, kläre zuerst, ob eine Funktion im echten
(Next.js/Supabase-)Stack umgesetzt werden soll – nicht blind gegen die
Unity/Node-Doku bauen.

## Konventionen & Guardrails

- **Deutsch** in UI, Kommentaren und Commits.
- **Mobile-first**, dunkles Theme; Tailwind-Utilities, keine neuen CSS-Frameworks.
- **Keine Secrets committen.** `.env*`, Service-Account-JSONs sind in
  `.gitignore`. Nur `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  werden clientseitig genutzt (public keys).
- Server-Code (`src/lib/supabase/server.ts`, `middleware.ts`) nie in
  Client-Components importieren.
- Vor dem Commit: `npm run build` und `npm run lint` grün.
- Inhaltlicher Kontext der App (legale Erotik-Dienstleistungen in DE) ist
  neutral/sachlich zu behandeln, siehe README.
