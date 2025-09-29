"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react"

interface Coin {
  id: string
  name: string
  symbol: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  logo: string
}

export default function CoinsPage() {
  const [user, setUser] = useState<any>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        // Mock coin data - in real app, this would come from crypto API
        setCoins([
          {
            id: "bitcoin",
            name: "Bitcoin",
            symbol: "BTC",
            price: 43250.75,
            change24h: 2.45,
            marketCap: 847000000000,
            volume24h: 15600000000,
            logo: "₿",
          },
          {
            id: "ethereum",
            name: "Ethereum",
            symbol: "ETH",
            price: 2650.3,
            change24h: -1.23,
            marketCap: 318000000000,
            volume24h: 8900000000,
            logo: "Ξ",
          },
          {
            id: "pcoin",
            name: "P-Coin",
            symbol: "PCN",
            price: 0.85,
            change24h: 5.67,
            marketCap: 85000000,
            volume24h: 2300000,
            logo: "P",
          },
          {
            id: "usdt",
            name: "Tether",
            symbol: "USDT",
            price: 1.0,
            change24h: 0.01,
            marketCap: 95000000000,
            volume24h: 25000000000,
            logo: "₮",
          },
        ])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: price < 1 ? 4 : 2,
    }).format(price)
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`
    return `$${marketCap.toLocaleString()}`
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">Cryptocurrency Prices</h1>
            <p className="text-muted-foreground">Live cryptocurrency market data</p>
          </div>

          <div className="grid gap-4">
            {coins.map((coin) => {
              const isPositive = coin.change24h > 0
              const isNegative = coin.change24h < 0
              const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

              return (
                <Card key={coin.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {coin.logo}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{coin.name}</h3>
                          <p className="text-muted-foreground">{coin.symbol}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatPrice(coin.price)}</div>
                        <div className="flex items-center gap-1">
                          <TrendIcon
                            className={`w-4 h-4 ${
                              isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {coin.change24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Market Cap</p>
                        <p className="font-semibold">{formatMarketCap(coin.marketCap)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">24h Volume</p>
                        <p className="font-semibold">{formatMarketCap(coin.volume24h)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
