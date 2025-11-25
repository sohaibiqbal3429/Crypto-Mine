"use client"

import dynamic from "next/dynamic"

import { TeamPageSkeleton } from "./team-page-skeleton"

const TeamPageClient = dynamic(() => import("./team-page-shell"), {
  ssr: false,
  loading: () => <TeamPageSkeleton />,
})

export default function TeamPage() {
  return <TeamPageClient />
}
