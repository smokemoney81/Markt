import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
} from "date-fns";
import { de } from "date-fns/locale";

export function euro(value: number | null | undefined): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value ?? 0);
}

export function dateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isToday(d)) return `Heute, ${format(d, "HH:mm", { locale: de })}`;
  if (isTomorrow(d)) return `Morgen, ${format(d, "HH:mm", { locale: de })}`;
  return format(d, "EEE, dd.MM. HH:mm", { locale: de });
}

export function dateShort(value: string | Date): string {
  const d = typeof value === "string" ? parseLocalDate(value) : value;
  return format(d, "dd.MM.yyyy", { locale: de });
}

/**
 * Heutiges Datum als lokaler `YYYY-MM-DD`-String. `new Date().toISOString()`
 * nutzt UTC und würde je nach Zeitzone einen Tag daneben liegen.
 */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parst einen Datum-String als LOKALES Datum. Ein reiner `YYYY-MM-DD`-String
 * würde von `new Date(...)` als UTC-Mitternacht interpretiert – in negativen
 * Zeitzonen landet er dadurch im Vortag/Vormonat. Diese Funktion baut das
 * Datum aus den Komponenten lokal auf; Strings mit Zeitanteil bleiben
 * unverändert (`new Date`).
 */
export function parseLocalDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

export function fromNow(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(d, { locale: de, addSuffix: true });
}

/** Stunden bis zum nächsten fälligen "nach oben schieben" einer Anzeige. */
export function bumpDue(
  lastBumpedAt: string | null,
  intervalHours: number,
): { dueInHours: number; overdue: boolean } {
  const last = lastBumpedAt ? new Date(lastBumpedAt).getTime() : Date.now();
  const next = last + intervalHours * 3600 * 1000;
  const dueInHours = (next - Date.now()) / 3600 / 1000;
  return { dueInHours, overdue: dueInHours <= 0 };
}
