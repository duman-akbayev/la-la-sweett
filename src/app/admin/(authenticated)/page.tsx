import { StatsCards } from "@/components/admin/StatsCards";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default function AdminDashboardPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-heading-1 text-brand-brown">Dashboard</h1>
        <p className="mt-1 text-body-sm text-brand-taupe">
          Overview of your bakery operations.
        </p>
      </div>

      <StatsCards />

      <div className="mt-10">
        <h2 className="mb-5 font-display text-heading-2 text-brand-brown">
          Recent Orders
        </h2>
        <OrdersTable />
      </div>
    </>
  );
}
