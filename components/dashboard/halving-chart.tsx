"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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
    <Card className="col-span-full lg:col-span-2 rounded-xl border border-border/70 bg-card/70 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.7)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-chart-3" />
          Network Efficiency Curve
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Network milestones vs hashing efficiency across the fleet. Higher density reduces per-node issuance.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={halvingData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="efficiency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="userScale" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "Hash output (RBlock/day)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area type="monotone" dataKey="performance" stroke="hsl(var(--chart-1))" fill="url(#efficiency)" strokeWidth={2.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
