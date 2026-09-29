// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { SVGProps } from "react"
import { Badge } from "@ui/components/reui/badge"
import { Frame, FramePanel } from "@ui/components/reui/frame"
import { Bar, BarChart, XAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@ui/primitives/chart"
import { chartConfig, chartData } from "./data"
import { TrendingUp } from "lucide-react"

const CHART_REVEAL_STYLE = `
@keyframes chart-29-bar-grow-up {
  from {
    transform: scaleY(0);
    opacity: 0.65;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

.chart-29-bar-grow-up {
  animation: chart-29-bar-grow-up 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-box: fill-box;
  transform-origin: bottom;
}

@media (prefers-reduced-motion: reduce) {
  .chart-29-bar-grow-up {
    animation: none;
    opacity: 1;
  }
}
`

// ── Custom tooltip ──

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: {
    dataKey: string
    color: string
    value: number
    payload: { category: string }
  }[]
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover min-w-[180px] rounded-lg border p-4 shadow-lg backdrop-blur-sm">
        <div className="text-popover-foreground border-border/50 mb-3 border-b pb-2 text-sm font-semibold">
          {payload[0].payload.category}
        </div>
        <div className="space-y-1.5">
          {payload.map((item) => (
            <div
              key={item.dataKey}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground text-xs font-medium">
                  {chartConfig[item.dataKey as keyof typeof chartConfig]
                    ?.label || item.dataKey}
                </span>
              </div>
              <span className="text-popover-foreground text-sm font-semibold">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ── Custom bar shape ──

const CustomHatchedBar = (
  props: SVGProps<SVGRectElement> & { dataKey?: string }
) => {
  const { fill, x, y, width, height, dataKey } = props
  return (
    <>
      <rect
        className="chart-29-bar-grow-up"
        rx={4}
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="none"
        fill={`url(#hatched-bar-pattern-${dataKey})`}
      />
      <defs>
        <pattern
          key={dataKey}
          id={`hatched-bar-pattern-${dataKey}`}
          x="0"
          y="0"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="10" height="10" opacity={0.5} fill={fill as string} />
          <rect width="1" height="10" fill={fill as string} />
        </pattern>
      </defs>
    </>
  )
}

const DottedBackgroundPattern = () => (
  <pattern
    id="default-pattern-dots"
    x="0"
    y="0"
    width="10"
    height="10"
    patternUnits="userSpaceOnUse"
  >
    <circle
      className="text-muted dark:text-muted/40"
      cx="2"
      cy="2"
      r="1"
      fill="currentColor"
    />
  </pattern>
)

export function Chart() {
  return (
    <Frame className="w-full max-w-2xl">
      <style>{CHART_REVEAL_STYLE}</style>
      {/* Content */}
      <FramePanel className="space-y-6">
        <div className="flex flex-col gap-px">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              Inventory Velocity
            </h3>
            <Badge variant="success-light" className="gap-1 border-none">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              <span>14.2%</span>
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Warehouse turnover rates by category
          </p>
        </div>

        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <rect
              x="0"
              y="0"
              width="100%"
              height="85%"
              fill="url(#default-pattern-dots)"
            />
            <defs>
              <DottedBackgroundPattern />
            </defs>
            <XAxis
              dataKey="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar
              dataKey="velocity"
              fill="var(--color-purple-500)"
              isAnimationActive={false}
              shape={<CustomHatchedBar />}
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  )
}