"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent } from "@/components/ui/card"

const halvingData = [
  { userScale: "1K", performance: 10 },
  { userScale: "10K", performance: 5 },
  { userScale: "100K", performance: 2.5 },
  { userScale: "1M", performance: 1.25 },
  { userScale: "10M", performance: 0.625 },
  { userScale: ">10M", performance: 0.3125 },
]

export function HalvingChart() {
  return (
    <Card className="relative overflow-hidden rounded-[32px] border border-white/30 bg-white/70 px-6 py-6 shadow-[0_20px_45px_rgba(87,65,217,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)]" aria-hidden />
      <CardContent className="relative px-0">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Halving 50%</p>
          <p className="text-2xl font-semibold text-foreground dark:text-white">Mining reactor efficiency</p>
          <p className="text-sm text-muted-foreground">
            Each 10× user milestone halves the base mining factor. This curve mirrors our deflationary schedule.
          </p>
        </div>
        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={halvingData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="halvingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="userScale" axisLine={false} tickLine={false} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value} Rb/d`}
                tick={{ fill: "var(--foreground)", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsla(var(--background) / 0.95)",
                  borderRadius: 16,
                  border: "1px solid hsla(var(--border) / 0.6)",
                  padding: "12px 16px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                formatter={(value: number) => [`${value} Rb/d`, "Performance"]}
              />
              <Area
                type="monotone"
                dataKey="performance"
                stroke="hsl(var(--chart-1))"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#halvingGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
