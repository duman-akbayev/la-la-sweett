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
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();

  const [orderResult, transitionsResult, notesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(name, email, phone)")
      .eq("id", id)
      .single(),
    supabase
      .from("order_state_transitions")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_notes")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (orderResult.error) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    order: orderResult.data,
    transitions: transitionsResult.data || [],
    notes: notesResult.data || [],
  });
}
