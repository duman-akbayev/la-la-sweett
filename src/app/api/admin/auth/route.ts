import { NextRequest, NextResponse } from "next/server";
import {
  validatePassword,
  createSession,
  destroySession,
} from "@/lib/admin-auth";

const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    LOGIN_ATTEMPTS.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip: string): void {
  LOGIN_ATTEMPTS.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const valid = await validatePassword(password);
    if (!valid) {
      recordAttempt(ip);
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 },
      );
    }

    clearAttempts(ip);
    await createSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
