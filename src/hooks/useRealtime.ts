"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtime(boardId: string | null, onRefresh?: (payload?: unknown) => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Stable ref so the subscribe callback always calls the latest version
  // without triggering a reconnect on every render
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!boardId) return;

    const channel = supabase.channel(`board-${boardId}`);
    
    channel
      .on("broadcast", { event: "refresh" }, (ev) => {
        // Pass payload through to the refresh handler (may contain task-level patch)
        try {
          onRefreshRef.current?.(ev?.payload ?? ev);
        } catch (err) {
          // swallow
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [boardId]); // onRefresh intentionally omitted — stable via ref

  const broadcastRefresh = useCallback(async (payload?: unknown) => {
    if (!boardId || !channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "refresh",
      payload: payload ?? { timestamp: new Date().toISOString() },
    });
  }, [boardId]);

  return { broadcastRefresh };
}
