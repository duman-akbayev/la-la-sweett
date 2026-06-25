import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/admin-auth";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authenticated = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!isDbConfigured()) {
    return NextResponse.json({ orders: [], total: 0, page: 1, totalPages: 0 });
  }

  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * limit;

  let query = supabase
    .from("orders")
    .select("*, customers(name, email, phone)", { count: "exact" });

  if (state && state !== "all") {
    query = query.eq("state", state);
  }

  if (search) {
    query = query.or(
      `design_description.ilike.%${search}%,flavor_preference.ilike.%${search}%,customers.name.ilike.%${search}%`,
    );
  }

  const validSortColumns = [
    "created_at",
    "event_date",
    "state",
    "quoted_price",
  ];
  const column = validSortColumns.includes(sortBy) ? sortBy : "created_at";
  const ascending = sortOrder === "asc";

  query = query.order(column, { ascending }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
