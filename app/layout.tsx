import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

import "./globals.css"

export const metadata: Metadata = {
  title: "Apple Mine | Luminous Mining Habitat",
  description:
    "Apple Mine is a cinematic mining habitat with bioluminescent dashboards, real-time vault telemetry, and ritualised earning flows for modern crews.",
  keywords: [
    "Apple Mine",
    "crypto mining platform",
    "vault dashboard",
    "team rewards",
    "digital wallet",
  ],
  authors: [{ name: "Apple Mine Studio" }],
  openGraph: {
    title: "Apple Mine",
    description:
      "Command a luminous mining habitat with adaptive yields, collaborative rituals, and cinematic telemetry across every device.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased text-foreground")}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
