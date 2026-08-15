"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Avoid SW interfering with local development / HMR
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal
    });
  }, []);
  return null;
}
