import type { OrderState } from "@/types";

const STATE_STYLES: Record<OrderState, { bg: string; text: string; label: string }> = {
  Inquiry: { bg: "bg-brand-taupe/10", text: "text-brand-taupe", label: "Inquiry" },
  Quoted: { bg: "bg-brand-gold/10", text: "text-brand-gold", label: "Quoted" },
  Deposit_Received: {
    bg: "bg-brand-rose-light/10",
    text: "text-brand-rose",
    label: "Deposit Received",
  },
  Confirmed: { bg: "bg-brand-rose/10", text: "text-brand-rose-dark", label: "Confirmed" },
  In_Production: { bg: "bg-purple-50", text: "text-purple-700", label: "In Production" },
  Ready: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Ready" },
  Delivered: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Delivered" },
  Picked_Up: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Picked Up" },
  Cancelled: { bg: "bg-red-50", text: "text-red-700", label: "Cancelled" },
};

export function OrderStatusBadge({ state }: { state: OrderState }) {
  const style = STATE_STYLES[state] || STATE_STYLES.Inquiry;

  return (
    <span
      className={`inline-flex items-center rounded-button px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
