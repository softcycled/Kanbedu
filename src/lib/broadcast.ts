import { createClient } from "@supabase/supabase-js";

// Initialize a server-side Supabase client using the Anon Key.
// Since our channels are protected by cryptographic secrecy (the realtimeSecret UUID),
// using the Anon Key to broadcast is perfectly secure.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Note: In Next.js serverless environments, we create this outside the function 
// so it is reused across warm invocations.
export const realtimeServerClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

/**
 * Broadcasts a refresh event to a securely generated board channel.
 * This guarantees that only clients who possess the cryptographic `realtimeSecret`
 * will receive the broadcast.
 */
export async function broadcastToBoard(realtimeSecret: string, payload?: any) {
  if (!realtimeSecret) return;
  
  // Use httpSend (explicit REST delivery) — server-side Next.js functions have no
  // persistent WebSocket, so send() was silently falling back to REST anyway.
  realtimeServerClient
    .channel(`board-${realtimeSecret}`)
    .httpSend("refresh", payload || { timestamp: new Date().toISOString() })
    .catch((err) => {
      console.error("Failed to broadcast realtime event:", err);
    });
}
