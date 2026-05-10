"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtime(boardId: string | null, onRefresh?: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Stable ref so the subscribe callback always calls the latest version
  // without triggering a reconnect on every render
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!boardId) return;

    const channel = supabase.channel(`board-${boardId}`);
    
    channel
      .on("broadcast", { event: "refresh" }, () => {
        onRefreshRef.current?.();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [boardId]); // onRefresh intentionally omitted — stable via ref

  const broadcastRefresh = useCallback(async () => {
    if (!boardId || !channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "refresh",
      payload: { timestamp: new Date().toISOString() },
    });
  }, [boardId]);

  return { broadcastRefresh };
}
