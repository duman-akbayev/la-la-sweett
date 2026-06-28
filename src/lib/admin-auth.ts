import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";
import { getSupabaseAdmin, isDbConfigured } from "./supabase";

const ADMIN_COOKIE = "la_la_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const inMemorySessions = new Map<string, number>();

function generateToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function validatePassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const input = Buffer.from(password);
  const expected = Buffer.from(adminPassword);
  if (input.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(input, expected);
}

export async function createSession(): Promise<string> {
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  if (isDbConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_sessions").insert({
      token,
      expires_at: new Date(expiresAt).toISOString(),
    });
  } else {
    inMemorySessions.set(token, expiresAt);
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
    const expiresAt = inMemorySessions.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      inMemorySessions.delete(token);
      return false;
    }
    return true;
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

  if (token) {
    if (isDbConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase.from("admin_sessions").delete().eq("token", token);
    } else {
      inMemorySessions.delete(token);
    }
  }

  cookieStore.delete(ADMIN_COOKIE);
}
