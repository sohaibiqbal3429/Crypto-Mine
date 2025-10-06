import type React from "react"
import { Suspense } from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { TopLoaderProvider } from "@/components/top-loader"
import { AppHeader } from "@/components/layout/app-header"
import { cn } from "@/lib/utils"

import "./globals.css"

export const metadata: Metadata = {
  title: "CryptoMine - Next-Generation Mining Platform",
  description:
    "Join our innovative mining ecosystem with referral rewards, team building, and sustainable earning opportunities.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased text-foreground")}>
        <Suspense fallback={null}>
          <TopLoaderProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <AppHeader />
              {children}
            </ThemeProvider>
          </TopLoaderProvider>
        </Suspense>
      </body>
    </html>
  )
}
