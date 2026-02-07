import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TenantProvider, WorkspaceProvider } from "@/core/multi-tenancy";
import { resolveTenantFromSubdomain } from "@/core/multi-tenancy/resolver";
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

/**
 * Root Layout for Consumer Portal
 * 
 * Note: TenantProvider and OrganizationProvider will be added
 * when the city portal features are developed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const hostname = host.split(":")[0];

  const { tenant } = await resolveTenantFromSubdomain(hostname);
  if (!tenant) {
    return {
      title: "SaaS Platform - Consumer Portal",
      description: "Consumer-facing portal for SaaS platform",
    };
  }

  return {
    title: `${tenant.name} - Portal`,
    description: `Consumer portal for ${tenant.name}`,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <TenantProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </TenantProvider>
      </body>
    </html>
  );
}

