"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderTimeline } from "@/components/admin/OrderTimeline";
import { OrderActions } from "@/components/admin/OrderActions";
import { OrderNotes } from "@/components/admin/OrderNotes";
import type { OrderState } from "@/types";

interface OrderDetail {
  id: string;
  state: OrderState;
  event_date: string;
  servings: number;
  flavor_preference: string;
  design_description: string;
  budget_range: string;
  quoted_price: number | null;
  deposit_amount: number | null;
  delivery_preference: string | null;
  delivery_address: string | null;
  originating_channel: string;
  cancellation_reason: string | null;
  refund_flagged: boolean;
  created_at: string;
  updated_at: string;
  customers: { name: string; email: string; phone: string } | null;
}

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  triggered_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      if (!res.ok) {
        setError("Order not found");
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setTransitions(data.transitions);
    } catch {
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStateChange = (newState: OrderState) => {
    if (order) {
      setOrder({ ...order, state: newState });
      fetchOrder();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-brand-cream" />
        <div className="h-64 animate-pulse rounded-card bg-white" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center">
        <p className="text-lg text-brand-taupe">{error || "Order not found"}</p>
        <Link
          href="/admin/orders"
          className="mt-4 inline-block text-sm font-medium text-brand-rose"
        >
          ← Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/orders"
          className="mb-3 inline-flex items-center text-sm text-brand-taupe transition-colors hover:text-brand-rose"
        >
          <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Orders
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="font-display text-heading-1 text-brand-brown">
            Order Details
          </h1>
          <OrderStatusBadge state={order.state} />
        </div>
        <p className="mt-1 text-body-sm text-brand-taupe">
          ID: {order.id}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main content */}
        <div className="space-y-6">
          {/* Order info card */}
          <div className="rounded-card border border-brand-rose/[0.06] bg-white p-6 shadow-card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-taupe">
              Order Information
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Customer</dt>
                <dd className="mt-0.5 text-sm font-medium text-brand-brown">
                  {order.customers?.name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Contact</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">
                  {order.customers?.phone || "—"}
                  <br />
                  <span className="text-brand-taupe">{order.customers?.email}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Event Date</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">
                  {new Date(order.event_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Servings</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">{order.servings}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Flavor</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">
                  {order.flavor_preference || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Budget</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">{order.budget_range}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Quoted Price</dt>
                <dd className="mt-0.5 text-sm font-medium text-brand-gold">
                  {order.quoted_price ? `$${order.quoted_price}` : "Not quoted"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Deposit</dt>
                <dd className="mt-0.5 text-sm text-brand-brown">
                  {order.deposit_amount ? `$${order.deposit_amount}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Delivery</dt>
                <dd className="mt-0.5 text-sm capitalize text-brand-brown">
                  {order.delivery_preference || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-brand-taupe">Channel</dt>
                <dd className="mt-0.5 text-sm capitalize text-brand-brown">
                  {order.originating_channel.replace(/_/g, " ")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-brand-taupe">Design Description</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-brand-brown">
                  {order.design_description || "—"}
                </dd>
              </div>
              {order.delivery_address && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-brand-taupe">Delivery Address</dt>
                  <dd className="mt-0.5 text-sm text-brand-brown">
                    {order.delivery_address}
                  </dd>
                </div>
              )}
              {order.cancellation_reason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-red-600">Cancellation Reason</dt>
                  <dd className="mt-0.5 text-sm text-red-700">
                    {order.cancellation_reason}
                  </dd>
                </div>
              )}
            </dl>
            {order.refund_flagged && (
              <div className="mt-4 rounded-input bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                Refund flagged — deposit may need to be returned.
              </div>
            )}
          </div>

          {/* Timeline */}
          <OrderTimeline currentState={order.state} transitions={transitions} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <OrderActions
            orderId={order.id}
            currentState={order.state}
            onStateChange={handleStateChange}
          />
          <OrderNotes orderId={order.id} />
        </div>
      </div>
    </>
  );
}
