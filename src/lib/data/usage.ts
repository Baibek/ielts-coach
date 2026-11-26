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
): Promise<Map<string, UsageSummary>> {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("ai_usage")
    .select("provider, tokens_in, tokens_out, ok, created_at")
    .gte("created_at", since)
    .limit(5000);
  const usage = new Map<string, UsageSummary>();
  for (const r of (data ?? []) as AiUsageRow[]) {
    if (dateInTz(r.created_at, timeZone) !== today) continue;
    const u = usage.get(r.provider) ?? { calls: 0, failed: 0, tin: 0, tout: 0 };
    u.calls++;
    if (!r.ok) u.failed++;
    u.tin += r.tokens_in;
    u.tout += r.tokens_out;
    usage.set(r.provider, u);
  }
  return usage;
}
