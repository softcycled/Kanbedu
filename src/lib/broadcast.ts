import { createClient } from "@supabase/supabase-js";

// Lazily create the server-side Supabase client used for realtime broadcasts.
// Created on first use (not at module load) so importing this module never
// throws when the Supabase env vars are absent — e.g. unit tests that import a
// route handler transitively. The instance is reused across warm invocations.
let client: ReturnType<typeof createClient> | null = null;

function getRealtimeClient(): ReturnType<typeof createClient> | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Broadcasts a refresh event to a securely generated board channel.
 * This guarantees that only clients who possess the cryptographic `realtimeSecret`
 * will receive the broadcast.
 */
export async function broadcastToBoard(realtimeSecret: string, payload?: any) {
  if (!realtimeSecret) return;

  const supa = getRealtimeClient();
  if (!supa) return;

  // Use httpSend (explicit REST delivery) — server-side Next.js functions have no
  // persistent WebSocket, so send() was silently falling back to REST anyway.
  supa
    .channel(`board-${realtimeSecret}`)
    .httpSend("refresh", payload || { timestamp: new Date().toISOString() })
    .catch((err) => {
      console.error("Failed to broadcast realtime event:", err);
    });
}
