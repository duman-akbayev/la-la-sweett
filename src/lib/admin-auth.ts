import { cookies } from "next/headers";
import { getSupabaseAdmin, isDbConfigured } from "./supabase";

const ADMIN_COOKIE = "la_la_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function validatePassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return password === adminPassword;
}

export async function createSession(): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  if (isDbConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_sessions").insert({
      token,
      expires_at: expiresAt,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return token;
}

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  if (!isDbConfigured()) {
    return token.length === 64;
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("admin_sessions")
    .select("expires_at")
    .eq("token", token)
    .single();

  if (!data) return false;
  return new Date(data.expires_at) > new Date();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (token && isDbConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_sessions").delete().eq("token", token);
  }

  cookieStore.delete(ADMIN_COOKIE);
}
