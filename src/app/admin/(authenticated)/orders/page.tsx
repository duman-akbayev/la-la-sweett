import { OrdersTable } from "@/components/admin/OrdersTable";

export default function AdminOrdersPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-heading-1 text-brand-brown">Orders</h1>
        <p className="mt-1 text-body-sm text-brand-taupe">
          Manage all customer orders. Filter by status, search, and update progress.
        </p>
      </div>

      <OrdersTable />
    </>
  );
}
