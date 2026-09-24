"use client";

import { useEffect } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const serviceWorkerUrl = `${basePath}/sw.js`;

/** Registers the PWA shell after the app is available in the browser. */
export function OfflineRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;

        // The first visit predates service-worker control. Send the resources
        // already used by this page so the next launch can work offline too.
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(window.location.origin));
        registration.active?.postMessage({ type: "CACHE_URLS", urls });
      } catch {
        // Offline support is progressive; a browser that disallows workers can
        // still run the trainer normally while it has a connection.
      }
    };

    void register();
  }, []);

  return null;
}
