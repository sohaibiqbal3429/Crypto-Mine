"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

const efficiencyData = [
  { userScale: "1K", efficiency: 92 },
  { userScale: "10K", efficiency: 88 },
  { userScale: "100K", efficiency: 83 },
  { userScale: "1M", efficiency: 78 },
  { userScale: "5M", efficiency: 72 },
  { userScale: "10M", efficiency: 68 },
]

export function HalvingChart() {
  return (
    <Card className="dashboard-card col-span-full border border-slate-800/80 bg-slate-900/80 shadow-lg shadow-emerald-500/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <div className="h-2 w-10 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
          Network efficiency arc
        </CardTitle>
        <p className="text-sm text-slate-400">
          Signal-to-yield projection across user milestones in the 5G mesh—distinct from MintMine’s halving bar.
        </p>
      </CardHeader>
      <CardContent>
        <div className="chart-container h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={efficiencyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" opacity={0.35} />
              <XAxis dataKey="userScale" tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={false} tickLine={false} domain={[60, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="efficiency"
                stroke="hsl(var(--chart-2))"
                strokeWidth={3}
                fill="url(#efficiencyGradient)"
                fillOpacity={1}
              />
              <defs>
                <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
