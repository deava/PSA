import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper";
import { SWRProvider } from "@/lib/swr-config";
import { ResourceHints } from "@/components/resource-hints";
import { LoadingProvider } from "@/components/loading-overlay";
import { AppWithClockProvider } from "@/components/app-with-clock-provider";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: 'Worklo - Professional Service Automation',
    template: '%s | Worklo',
  },
  description: 'Professional Service Automation Platform for Worklo - manage projects, track time, and streamline workflows.',
  openGraph: {
    title: 'Worklo - Professional Service Automation',
    description: 'Professional Service Automation Platform for Worklo - manage projects, track time, and streamline workflows.',
    type: 'website',
    siteName: 'Worklo',
  },
  twitter: {
    card: 'summary',
    title: 'Worklo - Professional Service Automation',
    description: 'Professional Service Automation Platform for Worklo',
  },
  icons: {
    icon: '/tab-logo.gif',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${raleway.variable} font-sans antialiased`} suppressHydrationWarning>
        <ResourceHints />
        <AuthProviderWrapper>
          <SWRProvider>
            <Suspense fallback={null}>
              <LoadingProvider>
                <ChunkErrorHandler />
                <AppWithClockProvider>
                  {children}
                </AppWithClockProvider>
                <Toaster theme="dark" toastOptions={{ style: { background: '#161D2B', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4F8' } }} />
              </LoadingProvider>
            </Suspense>
          </SWRProvider>
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
