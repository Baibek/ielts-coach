"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: "notAllowed" | "rate" | "email" | "code" | "generic";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { step: "email", email, error: "email" };
  if (!isEmailAllowed(email)) return { step: "email", email, error: "notAllowed" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    const rate = error.status === 429 || /rate|seconds/i.test(error.message);
    return { step: "email", email, error: rate ? "rate" : "generic" };
  }
  return { step: "code", email };
}

export async function verifyCode(prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? prev.email).trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!isEmailAllowed(email)) return { step: "email", email, error: "notAllowed" };
  if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "code" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "code" };
  redirect(safeNext(String(form.get("next") ?? "/")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
