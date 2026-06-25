import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/admin-auth";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/supabase";
import { VALID_TRANSITIONS, type OrderState } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authenticated = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { newState, quotedPrice } = await request.json();

  if (!newState) {
    return NextResponse.json(
      { error: "newState is required" },
      { status: 400 },
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("state")
    .eq("id", id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const currentState = order.state as OrderState;
  const allowedTransitions = VALID_TRANSITIONS[currentState] || [];

  if (!allowedTransitions.includes(newState as OrderState)) {
    return NextResponse.json(
      {
        error: `Cannot transition from "${currentState}" to "${newState}". Allowed: ${allowedTransitions.join(", ")}`,
      },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = { state: newState };
  if (quotedPrice !== undefined && newState === "Quoted") {
    updates.quoted_price = quotedPrice;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("order_state_transitions").insert({
    order_id: id,
    from_state: currentState,
    to_state: newState,
    triggered_by: "admin",
    metadata: quotedPrice ? { quoted_price: quotedPrice } : null,
  });

  return NextResponse.json({ ok: true, newState });
}
