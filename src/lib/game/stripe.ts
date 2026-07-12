import Stripe from "stripe";

/**
 * Stripe-Client (nur serverseitig). Lazy konstruiert, damit der Rest der App
 * auch ohne Stripe-Konfiguration läuft (dann ist `isStripeConfigured()` false
 * und der Shop fällt auf den 402-Pfad zurück).
 */
let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cached;
}

/** Basis-URL für Redirect-URLs (Checkout success/cancel). */
export function appBaseUrl(fallbackOrigin: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
}
