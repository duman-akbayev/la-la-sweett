import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/admin-auth";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const authenticated = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!isDbConfigured()) {
    return NextResponse.json({ notes: [] });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("order_notes")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Admin Notes GET]", error.message);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }

  return NextResponse.json({ notes: data || [] });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authenticated = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await request.json();

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 },
    );
  }

  if (content.length > 2000) {
    return NextResponse.json(
      { error: "Note must be under 2000 characters" },
      { status: 400 },
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("order_notes")
    .insert({ order_id: id, content: content.trim(), author: "admin" })
    .select()
    .single();

  if (error) {
    console.error("[Admin Notes POST]", error.message);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  return NextResponse.json({ note: data }, { status: 201 });
}
