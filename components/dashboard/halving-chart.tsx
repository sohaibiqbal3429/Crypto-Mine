"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const halvingData = [
  { userScale: "1K", performance: 10, label: "10 Rb/d" },
  { userScale: "10K", performance: 5, label: "5 Rb/d" },
  { userScale: "100K", performance: 2.5, label: "2.5" },
  { userScale: "1M", performance: 1.25, label: "1.25" },
  { userScale: "10M", performance: 0.625, label: "0.625" },
  { userScale: ">10M", performance: 0.3125, label: "0.3125" },
]

export function HalvingChart() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground dark:text-primary-dark">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded"></div>
          Halving 50%
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-secondary-dark">
          The base mining factor is halved every time the number of users increases by 10x...
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={halvingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="userScale"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--text-secondary-dark)" }}
                className="text-muted-foreground dark:text-secondary-dark"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--text-secondary-dark)" }}
                className="text-muted-foreground dark:text-secondary-dark"
                label={{
                  value: "Mining performance (RBlock/day)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-secondary-dark)", fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="performance" fill="url(#blueGradient)" radius={[4, 4, 0, 0]}>
                <defs>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" />
                    <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
