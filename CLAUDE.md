# CLAUDE.md

Leitfaden für Claude Code (und andere KI-Agenten) in diesem Repository.
Sprache im Projekt: **Deutsch** (UI-Texte, Kommentare, Commit-Messages, Doku).

## Was ist dieses Projekt?

**Markt Dashboard** – eine mobile-first **PWA** für Selbstständige zum Verwalten
von Anzeigen (z. B. markt.de), Kontakten/CRM, Terminen, Finanzen und Medien.
Alle Daten sind pro Nutzer über **Supabase Row Level Security** abgesichert.

Zusätzlich enthält das Repo zwei eigenständige Bausteine:

1. **Münz-Meister** (`/spiel`) – ein Coin-Master-Klon als kleines Casual-Spiel
   im Dashboard. **Serverautoritativ** über Supabase: Spielstand in `game_state`,
   alle Mutationen über API-Routen mit Service-Role-Key. Monetarisiert über
   Stripe-Shop und Rewarded Loop.
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

## Deployment & Live-Vorschau

- **Vercel-Projekt:** `markt` (Account/Team `bait-buddyvercelapp`).
- **PR-Deployments:** Jeder Push auf einen PR-Branch triggert ein Preview-Deployment
  bei Vercel. Die URL wird in den PR-Checks angezeigt; nutze sie zum Verifizieren,
  dass Änderungen live sichtbar sind.
- **Nach Änderungen immer in der Preview testen**, dass sie tatsächlich sichtbar sind –
  ein grüner lokaler Build allein garantiert nicht, dass die Live-App sie zeigt.

### Wichtig: Einheitlicher Branch-Flow (sonst Änderungen „unsichtbar")

PRs müssen immer gegen **denselben Base-Branch** gehen (den, den Vercel als
**Production Branch** deployt). Historisches Problem: Wenn PRs auf verschiedene
Branches zielen, landen Features divergiert – das Deployment zeigt dann nur
eine Seite, und Änderungen wirken „unsichtbar".

**Regeln:**

1. PRs **immer** gegen den Production-Branch öffnen (nicht wechselweise `main`
   und einen Feature-Branch).
2. Vor „fertig" sicherstellen: die **vereinte** Historie liegt auf dem
   Production-Branch bei Vercel.
3. Falls Feature-Branches divergieren: zusammenführen und mit `npm run build` +
   Preview-Deployment verifizieren, dass **alle** Seiten/Routen zusammen da sind.

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
    api/spiel/        # serverautoritative Spiel-Routen (spin/build/chest/daily/
                      #   bet/reset/state/shop/reward/purchase)
    login/            # Auth-Seite (Registrieren/Login)
    layout.tsx        # Root-Layout, Service-Worker-Registrierung
  components/
    game/CoinMasterGame.tsx   # Spiel-UI (Client-Component, dünner Renderer)
    BottomNav.tsx, PageHeader.tsx, ui.tsx, ...
  lib/
    supabase/         # client.ts, server.ts, service.ts, middleware.ts (SSR-Clients)
    game/
      coinmaster.ts   # Spiel-Logik & Balancing (pure functions, single source of truth)
      server.ts       # serverseitige Anwendung + Persistenz derselben Logik
      shop.ts         # Monetarisierung (Katalog, Rewarded Loop, Käufe)
      stripe.ts       # Stripe-Client (server-only) für den Kauf-Flow
      analytics.ts    # KPI-Aggregat (Betreiber) + Admin-Allowlist
      api.ts          # Client-Anbindung an die Spiel-Routen
    types.ts, format.ts, useTable.ts
supabase/migrations/0001_init.sql   # Dashboard-Schema + RLS + Storage-Bucket
supabase/migrations/0002_game.sql   # Spiel-Ökonomie (game_state, game_spin_log)
supabase/migrations/0003_shop.sql   # Monetarisierung (game_reward_log, game_purchases)
supabase/migrations/0004_analytics.sql  # KPI-Aggregat-Funktion game_analytics()
supabase/migrations/0005_streak.sql # Tagesbonus-Streak (Spalte game_state.daily_streak)
supabase/migrations/0006_build_time.sql # Bauzeit-Mechanik (Spalte game_state.item_builds)
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
  Änderungen an der Ökonomie **immer hier**, nicht in der UI und nicht dupliziert
  im Server-Code – `server.ts` nutzt genau diese pure functions.
- **UI:** `src/components/game/CoinMasterGame.tsx` (Client-Component) ist ein
  **dünner Renderer**: Jede Aktion läuft über die Server-Routen
  (`src/lib/game/api.ts`), der Zustand kommt autoritativ von Supabase zurück.
  Kein lokales `localStorage` für Spielmechanik.

### Serverautoritative Ökonomie (F2P-Fundament)

- **Warum:** Ein reiner localStorage-Spielstand ist trivial manipulierbar →
  keine Basis für Monetarisierung. Deshalb liegt der Spielstand serverseitig.
- **Wo:** Tabellen `game_state` / `game_spin_log` (Migration `0002_game.sql`).
  RLS erlaubt Spielern **nur SELECT** der eigenen Zeile – **keine** insert/
  update/delete-Policies. Alle Mutationen laufen über die Route-Handler unter
  `src/app/api/spiel/*` mit dem **Service-Role-Key** (`SUPABASE_SERVICE_ROLE_KEY`,
  serverseitig, geheim), der RLS autoritativ umgeht.
- **RNG & Coin-Mathematik** passieren serverseitig in `server.ts` (`performSpin`
  etc.). Der Nutzer wird aus der Session bestimmt, nie aus dem Request-Body.
- **Kampf (attack/raid):** wird beim Spin autoritativ vorgewürfelt und sofort
  gutgeschrieben; das Minispiel im Client ist dann nur noch Enthüllungs-Animation.
  Interaktive Kampfauflösung („Loch wählen") wäre ein Folgeschritt über pending
  sessions.
- **Einrichtung:** `SUPABASE_SERVICE_ROLE_KEY` setzen (siehe `.env.example`) und
  Migrationen `0002_game.sql` + `0003_shop.sql` im Supabase SQL-Editor ausführen.
  Ohne den Key antworten die Routen mit `503`.

### Monetarisierung (Shop & Rewarded Loop)

- **Wo:** `src/lib/game/shop.ts` (Katalog `SHOP_PRODUCTS`, `REWARD_GRANT`,
  `REWARD_DAILY_CAP`), Tabellen `game_reward_log` / `game_purchases`
  (Migration `0003_shop.sql`, RLS nur SELECT der eigenen Zeilen).
- **Routen:** `GET /api/spiel/shop`, `POST /api/spiel/reward` (gedeckelter
  Rewarded Loop), `POST /api/spiel/purchase`.
- **Rewarded Loop:** täglich gedeckelte Gratis-Belohnung (Retention-Hook). Wird
  zum Rewarded-Ad, sobald in `verifyAdToken` ein Ad-Netzwerk-Callback geprüft wird.
- **Käufe (Stripe):** `POST /api/spiel/checkout` legt eine Stripe-Checkout-
  Session an (Metadaten `userId`/`productId`) und liefert `{ url }` zum
  Weiterleiten. Die Gutschrift passiert **autoritativ im Webhook**
  (`POST /api/spiel/stripe-webhook`, Event `checkout.session.completed`,
  Signatur gegen `STRIPE_WEBHOOK_SECRET` geprüft) – nie beim Client-Rücksprung.
  Idempotent über `recordAndGrant` (insert-first auf `game_purchases`).
- **Fallbacks:** Ohne Stripe, aber mit `PAYMENTS_TEST_MODE=true` schreibt
  Checkout direkt gut (nur lokal, `provider='test'`). Ohne beides → `402`
  (kein „free money"). Stripe-Keys sind server-only (`.env.example`).
- **Middleware:** `/api`-Routen werden nicht auf `/login` umgeleitet (der
  Webhook hat keine Session) – sie prüfen Auth selbst.

### Analytics (Betreiber-KPIs)

- **Seite:** `/spiel/analytics` (Server-Component). Zeigt Aggregat-KPIs über
  **alle** Spieler: Umsatz, ARPPU/ARPU, Conversion, Aktive (1/7/30 T), Münzen
  im Umlauf, Faucet, Spin-Ergebnis-Verteilung.
- **Berechnung:** Postgres-Funktion `game_analytics()` (Migration
  `0004_analytics.sql`), aufgerufen über den Service-Role-Client.
- **Zugriff:** nur E-Mails aus `GAME_ADMIN_EMAILS` (kommagetrennt). Andere
  sehen „Kein Zugriff". Die Seite aggregiert über alle Nutzer – niemals ohne
  diesen Gate für normale Spieler öffnen.

## Hinweis zu den hochgeladenen Design-Dokumenten

Die Konzept-/Roadmap-Dateien (Unity-Client + Node.js/Express + PostgreSQL +
Firebase Auth + serverseitiges Anti-Cheat + IAP) beschreiben eine **andere,
größere Zielarchitektur**, die in **diesem** Repo **nicht** existiert. Der
**tatsächliche Stack** ist **Next.js 14 + Supabase**, und das Spiel ist bereits
**serverautoritativ** implementiert (nicht Client-Prototyp). Wenn du an der
Roadmap arbeitest, kläre zuerst, ob eine Funktion im echten (Next.js/Supabase-)
Stack umgesetzt werden soll – nicht blind gegen die Unity/Node-Doku bauen.

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
