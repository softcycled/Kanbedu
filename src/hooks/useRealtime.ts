"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useRealtime(channelSecret: string | null, onRefresh?: (payload?: unknown) => void) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!channelSecret) return;

    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Mutable ref so both setup() and the cleanup closure always point to the
    // current channel, including after a retry creates a new one.
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = () => {
      if (destroyed) return;
      channel = supabase.channel(`board-${channelSecret}`);
      channel
        .on("broadcast", { event: "refresh" }, (ev) => {
          try {
            onRefreshRef.current?.(ev?.payload ?? ev);
          } catch {}
        })
        .subscribe((status) => {
          // TIMED_OUT means the initial subscribe handshake failed (transient network).
          // Remove the dead channel and retry once after a short delay.
          if (status === "TIMED_OUT" && !destroyed) {
            if (channel) { supabase.removeChannel(channel); channel = null; }
            retryTimer = setTimeout(setup, 5000);
          }
        });
    };

    setup();

    return () => {
      destroyed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [channelSecret]);
}
