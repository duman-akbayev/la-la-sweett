"use client";

import type { OrderState } from "@/types";

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  triggered_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const STATE_ORDER: OrderState[] = [
  "Inquiry",
  "Quoted",
  "Deposit_Received",
  "Confirmed",
  "In_Production",
  "Ready",
  "Delivered",
];

export function OrderTimeline({
  currentState,
  transitions,
}: {
  currentState: OrderState;
  transitions: Transition[];
}) {
  const isCancelled = currentState === "Cancelled";
  const currentIndex = STATE_ORDER.indexOf(currentState);

  return (
    <div className="rounded-card border border-brand-rose/[0.06] bg-white p-6 shadow-card">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-brand-taupe">
        Order Progress
      </h3>

      {/* Visual progress bar */}
      <div className="relative mb-8">
        <div className="flex items-center justify-between">
          {STATE_ORDER.map((state, index) => {
            const isPast = index <= currentIndex && !isCancelled;
            const isCurrent = state === currentState;

            return (
              <div key={state} className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isCurrent
                      ? "border-brand-rose bg-brand-rose text-white shadow-button"
                      : isPast
                        ? "border-brand-rose bg-brand-rose/10 text-brand-rose"
                        : "border-brand-taupe/20 bg-white text-brand-taupe/40"
                  }`}
                >
                  {isPast && !isCurrent ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-bold">{index + 1}</span>
                  )}
                </div>
                <p
                  className={`mt-2 text-center text-[10px] font-medium ${
                    isCurrent ? "text-brand-rose" : isPast ? "text-brand-brown" : "text-brand-taupe/50"
                  }`}
                >
                  {state.replace(/_/g, " ")}
                </p>
              </div>
            );
          })}
        </div>

        {/* Connecting line */}
        <div className="absolute left-4 right-4 top-4 -z-10 h-0.5 bg-brand-taupe/10">
          <div
            className="h-full bg-brand-rose transition-all duration-700"
            style={{
              width: isCancelled
                ? "0%"
                : `${(currentIndex / (STATE_ORDER.length - 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {isCancelled && (
        <div className="mb-6 rounded-input bg-red-50 px-4 py-2.5 text-sm text-red-700">
          This order has been cancelled.
        </div>
      )}

      {/* Transition history */}
      {transitions.length > 0 && (
        <div className="border-t border-brand-rose/[0.06] pt-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-taupe">
            History
          </h4>
          <div className="space-y-2">
            {transitions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-input bg-brand-cream/40 px-3 py-2 text-xs"
              >
                <span className="text-brand-brown">
                  {t.from_state.replace(/_/g, " ")} → {t.to_state.replace(/_/g, " ")}
                </span>
                <span className="text-brand-taupe">
                  {new Date(t.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
