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
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "dd.MM.yyyy", { locale: de });
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
