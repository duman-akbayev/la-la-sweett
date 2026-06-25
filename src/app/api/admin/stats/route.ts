import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin-auth";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/supabase";

export async function GET() {
  const authenticated = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({
      totalOrders: 0,
      pendingInquiries: 0,
      inProduction: 0,
      completedThisMonth: 0,
      revenueThisMonth: 0,
      recentOrders: [],
    });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [totalResult, inquiryResult, productionResult, completedResult, recentResult] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("state", "Inquiry"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("state", "In_Production"),
      supabase
        .from("orders")
        .select("quoted_price")
        .in("state", ["Delivered", "Picked_Up"])
        .gte("updated_at", firstOfMonth),
      supabase
        .from("orders")
        .select("*, customers(name, email)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const completedOrders = completedResult.data || [];
  const revenueThisMonth = completedOrders.reduce(
    (sum, o) => sum + (o.quoted_price || 0),
    0,
  );

  return NextResponse.json({
    totalOrders: totalResult.count || 0,
    pendingInquiries: inquiryResult.count || 0,
    inProduction: productionResult.count || 0,
    completedThisMonth: completedOrders.length,
    revenueThisMonth,
    recentOrders: recentResult.data || [],
  });
}
