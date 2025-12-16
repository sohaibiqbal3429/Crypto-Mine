import type React from "react"
import { Suspense } from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { TopLoaderProvider } from "@/components/top-loader"
import { AppHeader } from "@/components/layout/app-header"
import { cn } from "@/lib/utils"

import "./globals.css"

export const metadata: Metadata = {
  title: "5gbotify | Network-grade mining control",
  description:
    "Operate the 5gbotify control plane for high-performance mining, payouts, and crew orchestration.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased text-foreground")}>
        <Suspense fallback={null}>
          <TopLoaderProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <AppHeader />
              {children}
            </ThemeProvider>
          </TopLoaderProvider>
        </Suspense>
      </body>
    </html>
  )
}
