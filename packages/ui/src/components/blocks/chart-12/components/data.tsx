// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"

import { type ChartConfig } from "@ui/primitives/chart"
import { ActivityIcon, SparklesIcon, CircleDollarSignIcon } from "lucide-react"

export type RangeKey = "week" | "month" | "quarter"

export interface InflowSource {
  id: "wavemark" | "envato" | "qbridge"
  name: string
  amount: number
  value: string
  color: string
  icon: ReactNode
}

export interface InflowRange {
  label: string
  total: string
  sources: InflowSource[]
}

export const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Last Week" },
  { key: "month", label: "Last Month" },
  { key: "quarter", label: "Last Quarter" },
]

const sourceIcons = {
  wavemark: (
    <ActivityIcon aria-hidden="true" />
  ),
  envato: (
    <SparklesIcon aria-hidden="true" />
  ),
  qbridge: (
    <CircleDollarSignIcon aria-hidden="true" />
  ),
} satisfies Record<InflowSource["id"], ReactNode>

export const inflowRanges: Record<RangeKey, InflowRange> = {
  week: {
    label: "Last Week",
    total: "$12.4M",
    sources: [
      {
        id: "wavemark",
        name: "WaveMark",
        amount: 7.6,
        value: "$7.6M",
        color: "oklch(57% 0.13 184)",
        icon: sourceIcons.wavemark,
      },
      {
        id: "envato",
        name: "Envato Inc.",
        amount: 3.4,
        value: "$3.4M",
        color: "oklch(76% 0.17 84)",
        icon: sourceIcons.envato,
      },
      {
        id: "qbridge",
        name: "QBridge B.V.",
        amount: 1.2,
        value: "$1.2M",
        color: "oklch(65% 0.21 45)",
        icon: sourceIcons.qbridge,
      },
    ],
  },
  month: {
    label: "Last Month",
    total: "$47.8M",
    sources: [
      {
        id: "wavemark",
        name: "WaveMark",
        amount: 28.4,
        value: "$28.4M",
        color: "oklch(57% 0.13 184)",
        icon: sourceIcons.wavemark,
      },
      {
        id: "envato",
        name: "Envato Inc.",
        amount: 13.6,
        value: "$13.6M",
        color: "oklch(76% 0.17 84)",
        icon: sourceIcons.envato,
      },
      {
        id: "qbridge",
        name: "QBridge B.V.",
        amount: 5.8,
        value: "$5.8M",
        color: "oklch(65% 0.21 45)",
        icon: sourceIcons.qbridge,
      },
    ],
  },
  quarter: {
    label: "Last Quarter",
    total: "$138.2M",
    sources: [
      {
        id: "wavemark",
        name: "WaveMark",
        amount: 79.1,
        value: "$79.1M",
        color: "oklch(57% 0.13 184)",
        icon: sourceIcons.wavemark,
      },
      {
        id: "envato",
        name: "Envato Inc.",
        amount: 42.5,
        value: "$42.5M",
        color: "oklch(76% 0.17 84)",
        icon: sourceIcons.envato,
      },
      {
        id: "qbridge",
        name: "QBridge B.V.",
        amount: 16.6,
        value: "$16.6M",
        color: "oklch(65% 0.21 45)",
        icon: sourceIcons.qbridge,
      },
    ],
  },
}

export const chartConfig = {
  wavemark: {
    label: "WaveMark",
    color: "oklch(57% 0.13 184)",
  },
  envato: {
    label: "Envato Inc.",
    color: "oklch(76% 0.17 84)",
  },
  qbridge: {
    label: "QBridge B.V.",
    color: "oklch(65% 0.21 45)",
  },
} satisfies ChartConfig