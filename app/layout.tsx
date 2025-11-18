import type React from "react"
import { Suspense } from "react"
import type { Metadata } from "next"
import { Manrope } from "next/font/google"

import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/theme-provider"
import { TopLoaderProvider } from "@/components/top-loader"
import { AppHeader } from "@/components/layout/app-header"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { cn } from "@/lib/utils"

import "./globals.css"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" })

const themeInitScript = `(() => {
  try {
    const stored = window.localStorage.getItem('${THEME_STORAGE_KEY}') || 'light';
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(stored === 'dark' ? 'dark' : 'light');
    root.style.colorScheme = stored === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();`

export const metadata: Metadata = {
  title: "CryptoMine - Next-Generation Mining Platform",
  description:
    "Join our innovative mining ecosystem with referral rewards, team building, and sustainable earning opportunities.",
  generator: "v0.app",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#000000" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased text-foreground", manrope.variable)}>
        <Suspense fallback={null}>
          <TopLoaderProvider>
            <ThemeProvider>
              <AppHeader />
              <MobileTabBar />
              {children}
            </ThemeProvider>
          </TopLoaderProvider>
        </Suspense>
      </body>
    </html>
  )
}
