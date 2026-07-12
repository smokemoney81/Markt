"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Ob die Seite beim Laden bereits von einem SW kontrolliert wurde.
    // Nur dann ist ein Controller-Wechsel ein echtes Update (kein Erst-Claim).
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      // Neuer Service Worker aktiv -> einmal neu laden, damit die neue
      // Version sofort sichtbar ist.
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Beim Start auf ein Update prüfen ...
        reg.update().catch(() => {});
        // ... und ein bereits wartendes Update sofort aktivieren.
        const promote = (worker: ServiceWorker | null) => {
          if (worker) worker.postMessage({ type: "SKIP_WAITING" });
        };
        promote(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed") promote(reg.waiting);
          });
        });
      })
      .catch(() => {
        /* SW-Registrierung fehlgeschlagen – nicht kritisch */
      });
  }, []);
  return null;
}
