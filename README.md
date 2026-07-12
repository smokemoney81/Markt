# Markt Dashboard 💗

Ein **mobile-first PWA-Dashboard** für Selbstständige, die ihre Anzeigen
(z. B. auf markt.de), Kontakte/Anfragen, Termine, Finanzen und Medien an einem
Ort verwalten wollen. Gebaut mit **Next.js + Supabase**, deploybar auf **Vercel**.

## Module

| Modul | Funktion |
|-------|----------|
| 📊 **Start** | Übersicht: Monatsumsatz, fällige Anzeigen-Bumps, nächste Termine |
| 📢 **Anzeigen** | markt.de-Anzeigen verwalten + Erinnerung zum „nach oben schieben" (Bump-Intervall) |
| 👥 **Kontakte** | Kunden-CRM: Status (Neu → Screening → Gebucht → Stammkunde), Bewertung, **Blacklist** & Screening-/Sicherheitsnotizen |
| 📅 **Termine** | Buchungskalender mit Dauer, Incall/Outcall, Anzahlung — direkt als Einnahme verbuchbar |
| 💰 **Finanzen** | Einnahmen & Ausgaben pro Monat, relevant für die Steuer |
| 🖼️ **Medien** | Foto-/Video-Manager mit Upload, Favoriten, privatem Storage |

Alle Daten sind pro Nutzer über **Row Level Security** abgesichert – niemand
sieht deine Daten.

## Setup

### 1. Supabase-Projekt anlegen
1. Konto auf [supabase.com](https://supabase.com) erstellen, neues Projekt anlegen.
2. Im **SQL Editor** den Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   einfügen und ausführen. Das erstellt alle Tabellen, Sicherheitsregeln und den
   privaten Storage-Bucket `media`.
3. Unter **Project Settings → API** findest du `Project URL` und `anon public key`.

### 2. Lokale Entwicklung
```bash
cp .env.example .env.local      # Werte aus Schritt 1 eintragen
npm install
npm run dev                     # http://localhost:3000
```
Beim ersten Start auf der Login-Seite **„Registrieren"** wählen, um dein Konto
anzulegen.

### 3. Deploy auf Vercel
1. Repo auf Vercel importieren.
2. Environment-Variablen setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Auf dem Handy über „Zum Startbildschirm hinzufügen" als App installieren (PWA).

## Tech-Stack
- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Postgres, Auth, Storage, RLS)
- **Tailwind CSS** – mobile-first, dunkles Design
- **PWA** – installierbar, Basis-Offline via Service Worker

## Weitere Tools im Repo
- [`local-llm`](local-llm) – Sprachmodelle **offline auf der eigenen Maschine**
  laufen lassen (llama.cpp, keine Cloud nötig).
- [`ollama-cloud`](ollama-cloud) – ein **Ollama-Modell auf Google Cloud hosten**
  (Cloud Run oder Compute Engine), Modell aus dem Ollama-Katalog oder direkt von
  Hugging Face, mit OpenAI-kompatibler API.

## Hinweis
Das Anbieten und Bewerben erotischer Dienstleistungen ist in Deutschland legal.
Beachte deine Pflichten (u. a. Anmeldung nach dem Prostituiertenschutzgesetz,
Gesundheitsberatung sowie die Steuerpflicht). Das Finanzen-Modul hilft dir, die
Einnahmen und Ausgaben sauber für die Steuererklärung zu dokumentieren.
