"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/data/queries";
import { finalizeMock, mockProgress, MOCK_STEPS } from "@/lib/mock/service";

export async function startMock(): Promise<void> {
  const { supabase } = await getSession();
  await supabase.from("mock_exams").update({ status: "abandoned" }).eq("status", "in_progress");
  await supabase.from("mock_exams").insert({ status: "in_progress" });
  revalidatePath("/mock");
}

export async function abandonMock(id: string): Promise<void> {
  const { supabase } = await getSession();
  await supabase.from("mock_exams").update({ status: "abandoned" }).eq("id", id);
  revalidatePath("/mock");
}

export async function finishMock(id: string): Promise<void> {
  const { supabase, profile } = await getSession();
  const { done } = await mockProgress(supabase, id);
  if (!MOCK_STEPS.every((s) => done[s])) return;
  await finalizeMock(supabase, profile, id);
  revalidatePath("/mock");
  revalidatePath("/");
  redirect(`/mock/${id}`);
}
