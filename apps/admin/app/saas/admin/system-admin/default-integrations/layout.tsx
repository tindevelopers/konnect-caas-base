export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DefaultIntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
