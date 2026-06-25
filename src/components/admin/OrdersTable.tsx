"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { OrderState } from "@/types";

interface OrderRow {
  id: string;
  state: OrderState;
  event_date: string;
  servings: number;
  flavor_preference: string;
  design_description: string;
  budget_range: string;
  quoted_price: number | null;
  created_at: string;
  customers: { name: string; email: string; phone: string } | null;
}

const ALL_STATES: OrderState[] = [
  "Inquiry",
  "Quoted",
  "Deposit_Received",
  "Confirmed",
  "In_Production",
  "Ready",
  "Delivered",
  "Picked_Up",
  "Cancelled",
];

export function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      sortBy,
      sortOrder,
    });
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, stateFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return (
      <span className="ml-1 text-brand-gold">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setStateFilter("all"); setPage(1); }}
            className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
              stateFilter === "all"
                ? "bg-brand-rose text-white"
                : "bg-brand-rose/[0.06] text-brand-taupe hover:bg-brand-rose/[0.12]"
            }`}
          >
            All ({total})
          </button>
          {ALL_STATES.map((state) => (
            <button
              key={state}
              onClick={() => { setStateFilter(state); setPage(1); }}
              className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                stateFilter === state
                  ? "bg-brand-rose text-white"
                  : "bg-brand-rose/[0.06] text-brand-taupe hover:bg-brand-rose/[0.12]"
              }`}
            >
              {state.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search orders..."
          className="w-full rounded-input border border-brand-rose/[0.1] bg-white px-4 py-2.5 text-sm text-brand-espresso placeholder:text-brand-taupe/50 focus:border-brand-rose focus:outline-none focus:ring-2 focus:ring-brand-rose/20 sm:w-64"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-brand-rose/[0.06] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-rose/[0.06] bg-brand-cream/30">
                <th className="px-5 py-3 font-medium text-brand-taupe">Customer</th>
                <th className="px-5 py-3 font-medium text-brand-taupe">Status</th>
                <th
                  className="cursor-pointer px-5 py-3 font-medium text-brand-taupe hover:text-brand-brown"
                  onClick={() => handleSort("event_date")}
                >
                  Event Date <SortIcon column="event_date" />
                </th>
                <th className="px-5 py-3 font-medium text-brand-taupe">Flavor</th>
                <th className="px-5 py-3 font-medium text-brand-taupe">Budget</th>
                <th
                  className="cursor-pointer px-5 py-3 font-medium text-brand-taupe hover:text-brand-brown"
                  onClick={() => handleSort("created_at")}
                >
                  Created <SortIcon column="created_at" />
                </th>
                <th className="px-5 py-3 font-medium text-brand-taupe"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-brand-rose/[0.04]">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-brand-cream" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-brand-taupe"
                  >
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-brand-rose/[0.04] transition-colors hover:bg-brand-blush/30"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-brand-brown">
                        {order.customers?.name || "—"}
                      </p>
                      <p className="text-xs text-brand-taupe">
                        {order.customers?.email || ""}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <OrderStatusBadge state={order.state} />
                    </td>
                    <td className="px-5 py-3.5 text-brand-brown">
                      {new Date(order.event_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-brand-taupe">
                      {order.flavor_preference || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-brand-taupe">
                      {order.budget_range}
                    </td>
                    <td className="px-5 py-3.5 text-brand-taupe">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-medium text-brand-rose transition-colors hover:text-brand-rose-dark"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-brand-rose/[0.06] px-5 py-3">
            <p className="text-xs text-brand-taupe">
              Page {page} of {totalPages} ({total} orders)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-input px-3 py-1.5 text-xs font-medium text-brand-brown transition-colors hover:bg-brand-cream disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-input px-3 py-1.5 text-xs font-medium text-brand-brown transition-colors hover:bg-brand-cream disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
