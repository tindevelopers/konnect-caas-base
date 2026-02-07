// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminLayout from "@/layout/AdminLayout";

export default function SaasPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
