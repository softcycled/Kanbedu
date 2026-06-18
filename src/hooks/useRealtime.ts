"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const POLL_INTERVAL = 3_000;

export function useRealtime(channelSecret: string | null, onRefresh?: (payload?: unknown) => void) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!channelSecret) return;

    // No Supabase credentials — fall back to polling
    if (!supabase) {
      const interval = setInterval(() => { onRefreshRef.current?.(); }, POLL_INTERVAL);
      const onVisibility = () => { if (!document.hidden) onRefreshRef.current?.(); };
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = () => {
      if (destroyed) return;
      channel = supabase!.channel(`board-${channelSecret}`);
      channel
        .on("broadcast", { event: "refresh" }, (ev) => {
          try { onRefreshRef.current?.(ev?.payload ?? ev); } catch {}
        })
        .subscribe((status) => {
          if (status === "TIMED_OUT" && !destroyed) {
            if (channel) { supabase!.removeChannel(channel); channel = null; }
            retryTimer = setTimeout(setup, 5000);
          }
        });
    };

    setup();

    const onVisibility = () => { if (!document.hidden) onRefreshRef.current?.(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      destroyed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (channel) supabase!.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channelSecret]);
}
