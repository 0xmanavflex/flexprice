// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type CSSProperties } from "react"
import { Frame, FramePanel } from "@ui/components/reui/frame"
import { cn } from "cn"

import { Button } from "@ui/components/primitives/button"
import { responseMetrics, type MetricGauge, type ResponseMetric } from "./data"
import { TrendingDown, TrendingUp, EllipsisVerticalIcon } from "lucide-react"

const gaugeSize = {
  className: "size-10",
  ringRadius: 14,
  strokeWidth: 2.5,
}

function hasActiveSegment(index: number, gauge: MetricGauge) {
  return (index - gauge.start + gauge.count) % gauge.count < gauge.active
}

function RadialSegmentChart({ gauge }: { gauge: MetricGauge }) {
  const { className, ringRadius, strokeWidth } = gaugeSize
  const center = 20

  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
      fill="none"
      viewBox="0 0 40 40"
    >
      {Array.from({ length: gauge.count }, (_, index) => {
        const angle = (index / gauge.count) * 360 - 90
        const innerRadius = ringRadius - 1.8
        const outerRadius = ringRadius + 1.8
        const radians = (angle * Math.PI) / 180
        const x1 = center + innerRadius * Math.cos(radians)
        const y1 = center + innerRadius * Math.sin(radians)
        const x2 = center + outerRadius * Math.cos(radians)
        const y2 = center + outerRadius * Math.sin(radians)
        const isActive = hasActiveSegment(index, gauge)

        return (
          <line
            key={index}
            stroke={
              isActive
                ? "var(--metric-gauge-color)"
                : "var(--metric-gauge-track)"
            }
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        )
      })}
    </svg>
  )
}

function TrendIcon({ tone }: { tone: ResponseMetric["trendTone"] }) {
  const isPositive = tone === "success"
  const wrap = "inline-flex size-[18px] shrink-0 items-center justify-center"

  if (!isPositive) {
    return (
      <span className={wrap}>
        <TrendingDown aria-hidden="true" className="size-full" />
      </span>
    )
  }

  return (
    <span className={wrap}>
      <TrendingUp aria-hidden="true" className="size-full" />
    </span>
  )
}

function DottedMetricBackground() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_center,var(--metric-dot-color)_0.8px,transparent_1.25px)] [mask-image:radial-gradient(ellipse_at_82%_86%,black_0%,black_32%,transparent_70%)] [background-size:6px_6px] opacity-45 blur-sm dark:opacity-25"
    />
  )
}

function MetricCard({
  metric,
  index,
  total,
}: {
  metric: ResponseMetric
  index: number
  total: number
}) {
  const isLast = index === total - 1
  const style = {
    "--metric-dot-color":
      "color-mix(in oklch, var(--muted-foreground) 18%, transparent)",
    "--metric-gauge-track":
      "color-mix(in oklch, var(--muted-foreground) 28%, transparent)",
  } as CSSProperties

  return (
    <div
      className={cn(
        "border-border/60 relative isolate flex min-h-[164px] flex-col overflow-hidden p-5",
        !isLast && "border-b @2xl:border-r @2xl:border-b-0"
      )}
      style={style}
    >
      <DottedMetricBackground />

      <div className="relative z-10 mb-7 flex items-center justify-between gap-3">
        <h3 className="text-muted-foreground text-sm font-medium">
          {metric.title}
        </h3>
        <Button
          aria-label={`${metric.title} actions`}
          className="text-muted-foreground -mr-2"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            {metric.gauges.map((gauge, gaugeIndex) => (
              <span
                key={`${metric.title}-${gaugeIndex}`}
                style={
                  {
                    "--metric-gauge-color": gauge.color,
                  } as CSSProperties
                }
              >
                <RadialSegmentChart gauge={gauge} />
              </span>
            ))}
          </div>

          <div className="flex min-w-0 items-baseline gap-1">
            <span className="text-2xl font-medium">{metric.value}</span>
            <span className="text-2xl font-medium">{metric.unit}</span>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 text-sm",
            metric.trendTone === "success" ? "text-success" : "text-destructive"
          )}
        >
          <TrendIcon tone={metric.trendTone} />
          <span className="text-muted-foreground/70">{metric.trendLabel}</span>
          <span className="font-medium">{metric.trendValue}</span>
        </div>
      </div>
    </div>
  )
}

export function Chart() {
  return (
    <div className="@container w-full max-w-4xl">
      <Frame className="w-full" spacing="xs">
        <FramePanel className="p-0!">
          <div className="grid overflow-hidden @2xl:grid-cols-3">
            {responseMetrics.map((metric, index) => (
              <MetricCard
                key={metric.title}
                metric={metric}
                index={index}
                total={responseMetrics.length}
              />
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}