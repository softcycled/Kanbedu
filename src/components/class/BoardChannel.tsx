"use client";

import { useRealtime } from "@/hooks/useRealtime";

// Headless subscriber: listens to one group board's realtime channel and fires
// onSignal on any refresh broadcast. Rendered once per group board so an
// educator panel (Monitor / Integrity) updates live as students change boards.
export default function BoardChannel({ secret, onSignal }: { secret: string; onSignal: () => void }) {
  useRealtime(secret, onSignal);
  return null;
}
