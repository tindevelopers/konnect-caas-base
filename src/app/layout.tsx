import { Outfit } from "next/font/google";
import "./globals.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "simplebar-react/dist/simplebar.min.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { TenantProvider, WorkspaceProvider } from "@/core/multi-tenancy";
import { WhiteLabelProvider } from "@/context/WhiteLabelContext";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-outfit",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <TenantProvider>
            <WorkspaceProvider>
              <WhiteLabelProvider>
                <SidebarProvider>{children}</SidebarProvider>
              </WhiteLabelProvider>
            </WorkspaceProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
