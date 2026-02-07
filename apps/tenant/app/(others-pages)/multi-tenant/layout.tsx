// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MultiTenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
