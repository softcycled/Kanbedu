"use client";

import { useEffect } from "react";

export default function CsrfPatch() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = function (resource, init) {
      if (init && ["POST", "PUT", "PATCH", "DELETE"].includes((init.method || "").toUpperCase())) {
        const match = document.cookie.match(/(^| )csrf-token=([^;]+)/);
        if (match) {
          init.headers = Object.assign({}, init.headers, { "x-csrf-token": match[2] });
        }
      }
      return original(resource, init);
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
