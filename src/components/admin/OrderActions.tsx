"use client";

import { useState } from "react";
import { VALID_TRANSITIONS, type OrderState } from "@/types";

interface OrderActionsProps {
  orderId: string;
  currentState: OrderState;
  onStateChange: (newState: OrderState) => void;
}

export function OrderActions({ orderId, currentState, onStateChange }: OrderActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotedPrice, setQuotedPrice] = useState("");

  const allowedTransitions = VALID_TRANSITIONS[currentState] || [];

  if (allowedTransitions.length === 0) {
    return (
      <div className="rounded-card border border-brand-rose/[0.06] bg-white p-6 shadow-card">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-taupe">
          Actions
        </h3>
        <p className="text-sm text-brand-taupe">
          No further actions available for this order state.
        </p>
      </div>
    );
  }

  const handleTransition = async (newState: OrderState) => {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { newState };
      if (newState === "Quoted" && quotedPrice) {
        body.quotedPrice = parseFloat(quotedPrice);
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update status");
        return;
      }

      onStateChange(newState);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = (state: OrderState) => {
    if (state === "Cancelled") {
      return "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
    }
    return "border border-brand-rose/20 bg-brand-rose/[0.06] text-brand-rose hover:bg-brand-rose hover:text-white";
  };

  return (
    <div className="rounded-card border border-brand-rose/[0.06] bg-white p-6 shadow-card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-taupe">
        Actions
      </h3>

      {error && (
        <div className="mb-4 rounded-input bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {currentState === "Inquiry" && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-brand-brown">
            Quoted Price ($)
          </label>
          <input
            type="number"
            value={quotedPrice}
            onChange={(e) => setQuotedPrice(e.target.value)}
            placeholder="e.g. 150"
            className="w-full rounded-input border border-brand-rose/[0.1] bg-white px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-taupe/50 focus:border-brand-rose focus:outline-none focus:ring-2 focus:ring-brand-rose/20"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {allowedTransitions.map((state) => (
          <button
            key={state}
            onClick={() => handleTransition(state)}
            disabled={loading}
            className={`rounded-button px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 ${getButtonStyle(state)}`}
          >
            {loading ? "..." : `→ ${state.replace(/_/g, " ")}`}
          </button>
        ))}
      </div>
    </div>
  );
}
