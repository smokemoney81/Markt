-- ============================================================
-- Markt.de Dashboard – Datenbankschema (Einzelanbieterin)
-- Alle Tabellen sind pro Nutzer über RLS (user_id = auth.uid())
-- abgesichert. Niemand sieht die Daten einer anderen Person.
-- ============================================================

-- ---------- ANZEIGEN ----------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  platform text not null default 'markt.de',
  category text,
  city text,
  url text,
  status text not null default 'aktiv',           -- aktiv | pausiert | abgelaufen
  price_paid numeric(10, 2),                       -- Kosten der Anzeige
  bump_interval_hours integer not null default 24, -- wie oft "nach oben schieben"
  last_bumped_at timestamptz default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- KONTAKTE / KUNDEN-CRM ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  source text default 'markt.de',                  -- markt.de | whatsapp | telefon | sonstig
  status text not null default 'neu',              -- neu | screening | gebucht | stammkunde | blacklist
  rating integer,                                   -- 1..5
  screening_notes text,                             -- Sicherheits-/Screening-Notizen
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- TERMINE ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  title text,
  starts_at timestamptz not null,
  duration_min integer not null default 60,
  location_type text default 'incall',             -- incall | outcall
  location text,
  price numeric(10, 2),
  deposit_paid boolean not null default false,
  status text not null default 'geplant',          -- geplant | bestaetigt | erledigt | abgesagt | no_show
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- FINANZEN ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'einnahme',           -- einnahme | ausgabe
  amount numeric(10, 2) not null,
  category text,                                    -- service | anzeige | hotel | anfahrt | sonstig
  description text,
  occurred_on date not null default current_date,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- MEDIEN (Foto / Video) ----------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'foto',               -- foto | video
  storage_path text not null,                       -- Pfad im Storage-Bucket
  title text,
  tags text[] default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- SERVICES / PREISLISTE ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  duration_min integer,
  price numeric(10, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.ads          enable row level security;
alter table public.contacts     enable row level security;
alter table public.appointments enable row level security;
alter table public.transactions enable row level security;
alter table public.media        enable row level security;
alter table public.services     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ads','contacts','appointments','transactions','media','services']
  loop
    execute format($f$
      create policy "own_select_%1$s" on public.%1$s
        for select using (auth.uid() = user_id);
      create policy "own_insert_%1$s" on public.%1$s
        for insert with check (auth.uid() = user_id);
      create policy "own_update_%1$s" on public.%1$s
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "own_delete_%1$s" on public.%1$s
        for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end$$;

-- ============================================================
-- INDIZES für schnelle Abfragen
-- ============================================================
create index if not exists idx_ads_user           on public.ads (user_id);
create index if not exists idx_contacts_user       on public.contacts (user_id);
create index if not exists idx_appointments_user   on public.appointments (user_id, starts_at);
create index if not exists idx_transactions_user   on public.transactions (user_id, occurred_on);
create index if not exists idx_media_user          on public.media (user_id);
create index if not exists idx_services_user       on public.services (user_id);

-- ============================================================
-- STORAGE BUCKET für Fotos/Videos (privat)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media_own_read" on storage.objects
  for select using (
    bucket_id = 'media' and owner = auth.uid()
  );
create policy "media_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'media' and owner = auth.uid()
  );
create policy "media_own_delete" on storage.objects
  for delete using (
    bucket_id = 'media' and owner = auth.uid()
  );
