"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Clock, Headphones, Loader2, MessageCircle, MessageSquareQuote, RadioReceiver } from "lucide-react"

interface SupportTicket {
  id: string
  subject: string
  status: "open" | "pending" | "resolved"
  priority: "low" | "medium" | "high"
  createdAt: string
  lastReply: string
}

const statusColors: Record<string, string> = {
  open: "bg-cyan-100 text-cyan-900",
  pending: "bg-amber-100 text-amber-900",
  resolved: "bg-emerald-100 text-emerald-900",
}

const priorityColors: Record<string, string> = {
  high: "bg-rose-100 text-rose-900",
  medium: "bg-purple-100 text-purple-900",
  low: "bg-blue-100 text-blue-900",
}

export default function SupportPage() {
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    priority: "medium" as "low" | "medium" | "high",
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        setTickets([
          {
            id: "TK-8821",
            subject: "Vault transfer review",
            status: "pending",
            priority: "high",
            createdAt: "2025-01-22T10:12:00Z",
            lastReply: "2025-01-22T13:44:00Z",
          },
          {
            id: "TK-8720",
            subject: "Alliance commission question",
            status: "open",
            priority: "medium",
            createdAt: "2025-01-20T06:40:00Z",
            lastReply: "2025-01-20T07:05:00Z",
          },
          {
            id: "TK-8405",
            subject: "Interface feedback",
            status: "resolved",
            priority: "low",
            createdAt: "2025-01-18T09:10:00Z",
            lastReply: "2025-01-19T11:32:00Z",
          },
        ])
      } catch (fetchError) {
        console.error("Failed to fetch data:", fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    setSuccess("")

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setSuccess("Transmission received. A support navigator will respond within the next cycle.")
      setFormData({ subject: "", message: "", priority: "medium" })
    } catch (err) {
      setError("Unable to submit your request. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#030614] via-[#04091f] to-[#0a0215] text-foreground">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-72">
        <div className="relative px-6 pb-10 pt-10">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-56 rounded-[4rem] bg-[radial-gradient(circle,_rgba(125,211,252,0.18),_transparent_70%)] blur-3xl" />
          <div className="relative z-10 mb-10 flex flex-col gap-4 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-[0_35px_90px_rgba(56,189,248,0.18)]">
            <div className="flex items-center gap-3 text-white">
              <RadioReceiver className="h-6 w-6" />
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">Support Orbit</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Apple Mine Navigator Desk</h1>
            <p className="max-w-3xl text-sm text-white/70">
              Every request is handled by human navigators immersed in the Apple Mine ecosystem. Share the signals you&apos;re seeing and we&apos;ll respond with clarity—not canned replies.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <Headphones className="h-4 w-4" /> 24/7 navigator coverage
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <Clock className="h-4 w-4" /> Avg response &lt; 2 hours
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <MessageSquareQuote className="h-4 w-4" /> Detailed follow-up rituals
              </span>
            </div>
          </div>

          <div className="relative z-10 grid gap-8 pb-12 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Open a support transmission</CardTitle>
                <CardDescription className="text-white/70">
                  Share context, attach priority, and our navigators will answer with actionable guidance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-semibold text-white/80">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      placeholder="Describe your signal"
                      value={formData.subject}
                      onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
                      className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-semibold text-white/80">
                      Priority
                    </Label>
                    <div className="flex gap-2">
                      {["low", "medium", "high"].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, priority: level as "low" | "medium" | "high" }))}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                            formData.priority === level
                              ? "border-white/80 bg-white/20 text-white"
                              : "border-white/20 bg-white/5 text-white/60 hover:border-white/40 hover:text-white"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-semibold text-white/80">
                      Message
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us what&apos;s happening in your habitat"
                      rows={6}
                      value={formData.message}
                      onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))}
                      className="rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                    />
                  </div>

                  {success && (
                    <Alert className="border-white/20 bg-white/10 text-white">
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending transmission…
                      </>
                    ) : (
                      "Send to Navigators"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Live contact channels</CardTitle>
                  <CardDescription className="text-white/70">
                    Speak to humans who can resolve issues quickly—no bots.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-white/70">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <MessageCircle className="h-5 w-5 text-white/80" />
                    <div>
                      <p className="font-semibold text-white">Live chat</p>
                      <p>Instant navigator access directly from the dashboard.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <Headphones className="h-5 w-5 text-white/80" />
                    <div>
                      <p className="font-semibold text-white">Voice line</p>
                      <p>Call +1-800-APPLE-MINE for urgent withdrawals.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <MessageSquareQuote className="h-5 w-5 text-white/80" />
                    <div>
                      <p className="font-semibold text-white">Community briefings</p>
                      <p>Weekly AMAs covering platform updates and strategy.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Your transmissions</CardTitle>
                  <CardDescription className="text-white/70">
                    Track recent support threads and their status.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tickets.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center text-sm text-white/60">
                      No transmissions logged yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{ticket.subject}</p>
                              <p className="text-xs text-white/60">#{ticket.id}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                              <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                            <span>Opened: {new Date(ticket.createdAt).toLocaleString()}</span>
                            <span>Last reply: {new Date(ticket.lastReply).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
