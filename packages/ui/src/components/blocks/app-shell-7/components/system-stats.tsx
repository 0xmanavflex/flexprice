// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { cn } from "cn"

import { Badge } from "@ui/components/primitives/badge"
import { Item, ItemMedia } from "@ui/components/primitives/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ui/components/primitives/popover"
import { Progress } from "@ui/components/primitives/progress"
import {
  AGENTS,
  RESOURCE_METRICS,
  type Agent,
  type ResourceMetric,
} from "./data"
import { ActivityIcon, ChevronRightIcon } from "lucide-react"

const HISTORY_LENGTH = 20
const UPDATE_INTERVAL_MS = 1000
const SPIKE_COLOR = "var(--color-red-500)"
const STATS_RANDOM_SEED = 1337
const DEMO_REFERENCE_DATE = new Date("2026-06-12T09:24:00")

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

// Seeded PRNG (mulberry32) keeps the demo metrics deterministic across
// renders and reloads while preserving the organic feel of live jitter.
function createSeededRandom(seed: number) {
  let state = seed

  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const nextRandom = createSeededRandom(STATS_RANDOM_SEED)

function randomInRange(min: number, max: number) {
  return Math.round((min + nextRandom() * (max - min)) * 10) / 10
}

function seedHistory(min: number, max: number): number[] {
  return Array.from({ length: HISTORY_LENGTH }, () => randomInRange(min, max))
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cx = (prev.x + curr.x) / 2
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

// ── Sparkline Area (full-width responsive) ──

function SparklineArea({
  data,
  max,
  color,
  spikeThreshold,
  height = 36,
}: {
  data: number[]
  max: number
  color: string
  spikeThreshold: number
  height?: number
}) {
  const gradientId = useId()
  const W = 100
  const H = height
  const currentValue = data[data.length - 1] ?? 0
  const hasSpike = currentValue > spikeThreshold
  const activeColor = hasSpike ? SPIKE_COLOR : color

  const pts = data.map((value, i) => ({
    x: data.length < 2 ? 0 : (i / (data.length - 1)) * W,
    y: H - (Math.min(value, max) / max) * (H - 2),
  }))

  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1 ? `${linePath} L ${W} ${H} L 0 ${H} Z` : ""

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="w-full"
      style={{ height: `${H}px` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={activeColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={activeColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={activeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Mini Sparkline (for agent rows) ──

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = useId()
  const W = 40
  const H = 14
  const dataMax = Math.max(...data, 1)

  const pts = data.map((value, i) => ({
    x: data.length < 2 ? 0 : (i / (data.length - 1)) * W,
    y: H - (value / dataMax) * (H - 1),
  }))

  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1 ? `${linePath} L ${W} ${H} L 0 ${H} Z` : ""

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Resource Card (grid cell) ──

function ResourceCard({
  metric,
  history,
}: {
  metric: ResourceMetric
  history: number[]
}) {
  const current = history[history.length - 1] ?? 0
  const max = metric.id === "memory" ? 16 : 100
  const isHigh = current > metric.spikeThreshold

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Item
            className="flex size-5 shrink-0 items-center justify-center p-0 transition-colors duration-300"
            style={{
              backgroundColor: `${isHigh ? SPIKE_COLOR : metric.color}18`,
            }}
          >
            <ItemMedia
              variant="icon"
              className="size-auto"
              style={{ color: isHigh ? SPIKE_COLOR : metric.color }}
            >
              {metric.icon}
            </ItemMedia>
          </Item>
          <span className="text-muted-foreground truncate text-[11px]">
            {metric.label}
          </span>
        </div>
        <span
          className="shrink-0 text-xs font-semibold tabular-nums transition-colors duration-300"
          style={{ color: isHigh ? SPIKE_COLOR : metric.color }}
        >
          {current}
          <span className="text-muted-foreground ml-0.5 text-[10px] font-normal">
            {metric.unit}
          </span>
        </span>
      </div>
      <SparklineArea
        data={history}
        max={max}
        color={metric.color}
        spikeThreshold={metric.spikeThreshold}
      />
    </div>
  )
}

// ── Agent Memory Row ──

type AgentWithHistory = Agent & { history: number[] }

function AgentMemoryRow({ agent }: { agent: AgentWithHistory }) {
  const barPercent = Math.min(100, (agent.memoryMb / 512) * 100)

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: agent.color }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
        {agent.name}
      </span>
      <Progress
        value={barPercent}
        className="w-12 **:data-[slot=progress-indicator]:bg-(--bar-color) **:data-[slot=progress-track]:h-1"
        style={{ "--bar-color": agent.color } as CSSProperties}
      />
      <span className="text-muted-foreground w-10 text-right text-[10px] tabular-nums">
        {agent.memoryMb}MB
      </span>
    </div>
  )
}

// ── Status Badge ──

function StatusBadge({ spiking }: { spiking: boolean }) {
  return (
    <Badge
      className={cn(
        "h-4 border-0 px-1.5 text-[10px] font-medium",
        spiking
          ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
          : "bg-success/10 text-success dark:bg-success/20"
      )}
    >
      {spiking ? "Alert" : "Normal"}
    </Badge>
  )
}

// ── System Stats ──

export function SystemStats() {
  const [histories, setHistories] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {}
    for (const m of RESOURCE_METRICS) {
      initial[m.id] = seedHistory(m.seedRange[0], m.seedRange[1])
    }
    return initial
  })

  const [agentData, setAgentData] = useState<AgentWithHistory[]>(() =>
    AGENTS.map((a) => ({
      ...a,
      history: Array.from({ length: 10 }, () =>
        Math.max(32, Math.round(a.memoryMb + (nextRandom() - 0.5) * 80))
      ),
    }))
  )

  const [showAgents, setShowAgents] = useState(true)
  const [now, setNow] = useState(DEMO_REFERENCE_DATE)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  // Derived - no extra state needed
  const spiking = RESOURCE_METRICS.some((m) => {
    const history = histories[m.id] ?? []
    const current = history[history.length - 1] ?? 0
    return current > m.spikeThreshold
  })

  const tick = useCallback(() => {
    setHistories((prev) => {
      const next: Record<string, number[]> = {}
      for (const m of RESOURCE_METRICS) {
        const old = prev[m.id] ?? []
        const jitter = randomInRange(
          m.seedRange[0] * 0.8,
          m.seedRange[1] * 1.15
        )
        const clamped =
          m.id === "memory"
            ? Math.min(16, Math.max(0, jitter))
            : Math.min(100, Math.max(0, jitter))
        next[m.id] = [...old.slice(-(HISTORY_LENGTH - 1)), clamped]
      }
      return next
    })

    setAgentData((prev) =>
      prev.map((a) => {
        const newMb = Math.max(
          32,
          Math.round(a.memoryMb + (nextRandom() - 0.5) * 20)
        )
        return {
          ...a,
          memoryMb: newMb,
          history: [...a.history.slice(-9), newMb],
        }
      })
    )

    setNow((prev) => new Date(prev.getTime() + UPDATE_INTERVAL_MS))
  }, [])

  useEffect(() => {
    intervalRef.current = setInterval(tick, UPDATE_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tick])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="System monitor"
            className={cn(
              "relative inline-flex h-7 items-center gap-1.5 px-2 transition-colors outline-none",
              "rounded-md",
              "border-border hover:bg-accent focus-visible:ring-ring border focus-visible:ring-2"
            )}
          />
        }
      >
        {/* Icon with beep ring on spike */}
        <span className="relative flex size-3.5 items-center justify-center">
          <ActivityIcon className={cn(
                                "size-3.5 transition-colors duration-300",
                                spiking ? "text-destructive" : "text-muted-foreground"
                              )} aria-hidden="true" />
          {spiking && (
            <span
              className="bg-destructive/25 absolute inset-0 animate-ping rounded-full"
              aria-hidden="true"
            />
          )}
        </span>
        {/* the trigger already carries aria-label="System monitor", and the
            icon + status badge carry the whole signal - so the text label is
            the first thing to yield when the header runs out of room */}
        <span className="text-foreground hidden text-xs font-medium sm:inline">
          System
        </span>
        <StatusBadge spiking={spiking} />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 gap-0! space-y-0! p-0!"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-foreground text-xs font-medium">
            System Monitor
          </span>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {TIME_FORMATTER.format(now)}
          </span>
        </div>

        {/* 2×2 Resource Grid */}
        <div className="grid grid-cols-2">
          {RESOURCE_METRICS.map((metric, i) => (
            <div
              key={metric.id}
              className={cn(
                i % 2 === 1 && "border-border border-l",
                i >= 2 && "border-border border-t"
              )}
            >
              <ResourceCard
                metric={metric}
                history={histories[metric.id] ?? []}
              />
            </div>
          ))}
        </div>

        {/* Per-Agent Memory */}
        <div className="border-border border-t">
          <button
            type="button"
            onClick={() => setShowAgents((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors"
            aria-expanded={showAgents}
            aria-controls="agent-memory-panel"
          >
            <ChevronRightIcon className={cn(
                                      "size-3 shrink-0 transition-transform duration-200",
                                      showAgents && "rotate-90"
                                    )} aria-hidden="true" />
            Per-Agent Memory
          </button>

          {showAgents && (
            <div id="agent-memory-panel" className="pb-2">
              {agentData.map((agent) => (
                <AgentMemoryRow key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}