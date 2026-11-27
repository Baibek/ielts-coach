import "server-only";
import { dateInTz } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";
import type { AiUsageRow } from "./types";

export type UsageSummary = { calls: number; failed: number; tin: number; tout: number };

/** Today's AI calls per provider, in the user's local day. */
export async function usageToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeZone: string,
  today: string,
): Promise<{ usage: Map<string, UsageSummary>; lastError: string | null }> {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("ai_usage")
    .select("provider, tokens_in, tokens_out, ok, error, created_at")
    .gte("created_at", since)
    .limit(5000);
  const usage = new Map<string, UsageSummary>();
  let lastError: { at: string; text: string } | null = null;
  for (const r of (data ?? []) as Array<AiUsageRow & { error: string | null }>) {
    if (!r.ok && r.error && (!lastError || r.created_at > lastError.at)) lastError = { at: r.created_at, text: r.error };
    if (dateInTz(r.created_at, timeZone) !== today) continue;
    const u = usage.get(r.provider) ?? { calls: 0, failed: 0, tin: 0, tout: 0 };
    u.calls++;
    if (!r.ok) u.failed++;
    u.tin += r.tokens_in;
    u.tout += r.tokens_out;
    usage.set(r.provider, u);
  }
  return { usage, lastError: lastError?.text ?? null };
}
