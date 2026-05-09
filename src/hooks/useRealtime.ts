"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtime(boardId: string | null, onRefresh?: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!boardId) return;

    // Initialize channel
    const channel = supabase.channel(`board-${boardId}`);
    
    channel
      .on("broadcast", { event: "refresh" }, (payload) => {
        console.log("🚀 Realtime: Sync event received!", payload);
        if (onRefresh) onRefresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Realtime: Connected to board-${boardId}`);
        } else {
          console.log(`⚠️ Realtime Status for board-${boardId}:`, status);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [boardId, onRefresh]);

  const broadcastRefresh = useCallback(async () => {
    if (!boardId || !channelRef.current) return;
    
    console.log("Realtime: Broadcasting refresh event...");
    await channelRef.current.send({
      type: "broadcast",
      event: "refresh",
      payload: { 
        timestamp: new Date().toISOString(),
        senderId: Math.random().toString(36).substring(7) 
      },
    });
  }, [boardId]);

  return { broadcastRefresh };
}
