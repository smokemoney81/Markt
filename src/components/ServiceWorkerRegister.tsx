"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW-Registrierung fehlgeschlagen – nicht kritisch */
      });
    }
  }, []);
  return null;
}
