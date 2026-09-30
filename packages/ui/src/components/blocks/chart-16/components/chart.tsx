// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@ui/components/reui/frame"
import { cn } from "cn"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@ui/components/primitives/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"
import {
  chartConfig,
  conversionFunnelData,
  periodChanges,
  PeriodKey,
  rangeOptions,
  stageMetrics,
} from "./data"
import { TrendingUp, TrendingDown } from "lucide-react"

// ── Custom tooltip ──

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: {
    dataKey: string
    color: string
    value: number
    payload: unknown
  }[]
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover min-w-[200px] rounded-lg border p-4 shadow-lg backdrop-blur-sm">
        <div className="text-popover-foreground border-border/50 mb-3.5 border-b pb-2 text-sm font-semibold">
          {label}
        </div>
        <div className="space-y-1.5">
          {stageMetrics.map((stage) => {
            const dataPoint = payload.find((p) => p.dataKey === stage.key)
            const value = dataPoint?.value || 0
            return (
              <div
                key={stage.key}
                className="flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    {stage.label}
                  </span>
                </div>
                <span className="text-popover-foreground text-sm font-semibold">
                  {value.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}

export function Chart() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("30d")
  const currentData = conversionFunnelData[selectedPeriod] || []
  const latestData = currentData[currentData.length - 1] || {}

  return (
    <Frame className="w-full max-w-3xl">
      <FrameHeader className="flex flex-row items-center justify-between gap-2 px-2! py-1.5!">
        <FrameTitle>Conversion Funnel</FrameTitle>
        <Select
          value={selectedPeriod}
          onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}
          items={rangeOptions}
        >
          <SelectTrigger className="w-fit min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="w-40"
            align="start"
          >
            {rangeOptions.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FrameHeader>
      <FramePanel className="space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-6 p-2 md:grid-cols-4">
          {stageMetrics.map((stage) => {
            const value = latestData[
              stage.key as keyof typeof latestData
            ] as number
            const change = periodChanges[selectedPeriod]?.[stage.key] ?? 0
            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="bg-border/60 h-12 w-0.5 rounded-full" />
                  <div className="flex flex-col gap-2">
                    <div className="text-muted-foreground text-xs font-medium">
                      {stage.label}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none font-semibold">
                        {value?.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-4",
                          change >= 0 ? "text-emerald-500" : "text-destructive"
                        )}
                      >
                        {change >= 0 ? (
                          <TrendingUp aria-hidden="true" />
                        ) : (
                          <TrendingDown aria-hidden="true" />
                        )}
                        {Math.abs(change)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart
            accessibilityLayer
            data={currentData}
            margin={{ top: 10, bottom: 10, left: 5, right: 5 }}
          >
            <defs>
              <linearGradient id="fillStoreVisits" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-storeVisits)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-storeVisits)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillProductViews" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-productViews)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-productViews)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillAddToCart" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-addToCart)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-addToCart)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillCheckout" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-checkout)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-checkout)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
            />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fontSize: 12 }}
            />
            <YAxis hide />
            <ChartTooltip content={<CustomTooltip />} />
            <Area
              dataKey="checkout"
              type="natural"
              fill="url(#fillCheckout)"
              stroke="var(--color-checkout)"
              stackId="a"
            />
            <Area
              dataKey="addToCart"
              type="natural"
              fill="url(#fillAddToCart)"
              stroke="var(--color-addToCart)"
              stackId="a"
            />
            <Area
              dataKey="productViews"
              type="natural"
              fill="url(#fillProductViews)"
              stroke="var(--color-productViews)"
              stackId="a"
            />
            <Area
              dataKey="storeVisits"
              type="natural"
              fill="url(#fillStoreVisits)"
              stroke="var(--color-storeVisits)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  )
}