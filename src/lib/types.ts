// Zentrale Typen, passend zum Datenbankschema (supabase/migrations/0001_init.sql)

export type AdStatus = "aktiv" | "pausiert" | "abgelaufen";

export interface Ad {
  id: string;
  user_id: string;
  title: string;
  platform: string;
  category: string | null;
  city: string | null;
  url: string | null;
  status: AdStatus;
  price_paid: number | null;
  bump_interval_hours: number;
  last_bumped_at: string | null;
  notes: string | null;
  created_at: string;
}

export type ContactStatus =
  | "neu"
  | "screening"
  | "gebucht"
  | "stammkunde"
  | "blacklist";

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  source: string | null;
  status: ContactStatus;
  rating: number | null;
  screening_notes: string | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus =
  | "geplant"
  | "bestaetigt"
  | "erledigt"
  | "abgesagt"
  | "no_show";

export interface Appointment {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string | null;
  starts_at: string;
  duration_min: number;
  location_type: "incall" | "outcall" | null;
  location: string | null;
  price: number | null;
  deposit_paid: boolean;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
}

export type TransactionType = "einnahme" | "ausgabe";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_on: string;
  appointment_id: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  user_id: string;
  kind: "foto" | "video";
  storage_path: string;
  title: string | null;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  duration_min: number | null;
  price: number | null;
  active: boolean;
  created_at: string;
}
