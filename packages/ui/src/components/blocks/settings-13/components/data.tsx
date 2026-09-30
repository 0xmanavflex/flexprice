"use client"

import type { ReactNode } from "react"

import { Discord } from "@ui/primitives/svgs/discord"
import { Gemini } from "@ui/primitives/svgs/gemini"
import { Loom } from "@ui/primitives/svgs/loom"
import { N8n } from "@ui/primitives/svgs/n8n"
import { Slack } from "@ui/primitives/svgs/slack"
import { Spotify } from "@ui/primitives/svgs/spotify"
import { Stripe } from "@ui/primitives/svgs/stripe"
import { Supabase } from "@ui/primitives/svgs/supabase"
import { Zoom } from "@ui/primitives/svgs/zoom"

// ── Types ──

export interface IntegrationApp {
  id: string
  description: string
  logo: ReactNode
  connected: boolean
}

// ── Data ──

const logoClassName = "size-6"

export const integrationApps: IntegrationApp[] = [
  {
    id: "slack",
    description: "Releases, on-call alerts, and approvals in your channels.",
    logo: <Slack className={logoClassName} />,
    connected: true,
  },
  {
    id: "stripe",
    description: "Charges, retries, and payouts across connected tools.",
    logo: <Stripe className={logoClassName} />,
    connected: false,
  },
  {
    id: "supabase",
    description: "DB and auth events for live dashboards.",
    logo: <Supabase className={logoClassName} />,
    connected: true,
  },
  {
    id: "n8n",
    description: "Automation runs: successes and failures in one place.",
    logo: <N8n className={logoClassName} />,
    connected: true,
  },
  {
    id: "zoom",
    description: "Recordings, attendance, and follow-ups synced.",
    logo: <Zoom className={logoClassName} />,
    connected: false,
  },
  {
    id: "loom",
    description: "Async walkthroughs and feedback in one queue.",
    logo: <Loom className={logoClassName} />,
    connected: true,
  },
  {
    id: "discord",
    description: "Community signals and mod flags to internal channels.",
    logo: <Discord className={logoClassName} />,
    connected: false,
  },
  {
    id: "gemini",
    description: "AI for documents and content workflows.",
    logo: <Gemini className={logoClassName} />,
    connected: false,
  },
  {
    id: "spotify",
    description: "Playlists and listening data for workspace apps.",
    logo: <Spotify className={logoClassName} />,
    connected: false,
  },
]