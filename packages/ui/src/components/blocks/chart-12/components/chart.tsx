// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState, type CSSProperties } from "react"
import { cn } from "cn"
import { Cell, Pie, PieChart } from "recharts"

import { Button } from "@ui/primitives/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ui/primitives/chart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import { Item, ItemMedia } from "@ui/primitives/item"
import { Separator } from "@ui/primitives/separator"
import {
  chartConfig,
  inflowRanges,
  rangeOptions,
  type InflowSource,
  type RangeKey,
} from "./data"
import { ChevronDownIcon } from "lucide-react"

function GaugeGrid() {
  const gridPattern =
    "[background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:8px_8px]"

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-40 [mask-image:linear-gradient(to_bottom,black_0%,black_42%,transparent_100%)] opacity-35",
          gridPattern
        )}
      />
      <div
        className={cn(
          "absolute -inset-x-8 top-7 h-44 [mask-image:radial-gradient(ellipse_88%_76%_at_50%_16%,black_0%,black_46%,transparent_100%)] opacity-45 blur-md",
          gridPattern
        )}
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_bottom,transparent_0%,var(--card)_72%,var(--card)_100%)]" />
    </div>
  )
}

function RangeMenu({
  selectedRange,
  onSelectRange,
}: {
  selectedRange: RangeKey
  onSelectRange: (range: RangeKey) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-24 justify-between gap-1.5 px-3"
            aria-label="Change inflow range"
          />
        }
      >
        <span>{inflowRanges[selectedRange].label}</span>
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-40">
        <DropdownMenuGroup>
          {rangeOptions.map((range) => (
            <DropdownMenuItem
              key={range.key}
              onClick={() => onSelectRange(range.key)}
            >
              {range.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SourceIcon({ source }: { source: InflowSource }) {
  return (
    <Item
      className={cn(
        "dark:border-border relative isolate flex size-8 items-center justify-center overflow-hidden border-2 border-white bg-[var(--source-icon-bg)] p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:bg-neutral-950 dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] [&_svg]:size-4 [&_svg]:text-white",
        source.id !== "qbridge" && "dark:[--source-stipple-opacity:0.38]",
        source.id === "qbridge" && "dark:[--source-stipple-opacity:0.3]"
      )}
      style={{ "--source-icon-bg": source.color } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.22)_0.6px,transparent_0.65px)] [background-size:3px_3px] opacity-[var(--source-stipple-opacity,0)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] [background-image:radial-gradient(48.05%_48.05%_at_50%_5.95%,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_100%)]"
      />
      <ItemMedia variant="icon" className="relative z-10 size-auto">
        {source.icon}
      </ItemMedia>
    </Item>
  )
}

function SourceMetric({ source }: { source: InflowSource }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 px-2 text-center">
      <SourceIcon source={source} />
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">{source.name}</div>
        <div className="text-base font-medium">{source.value}</div>
      </div>
    </div>
  )
}

export function Chart() {
  const [selectedRange, setSelectedRange] = useState<RangeKey>("week")
  const currentRange = inflowRanges[selectedRange]

  return (
    <Card className="w-full max-w-[360px] gap-0 overflow-hidden py-0">
      {/* Header */}
      <CardHeader className="relative z-10 flex items-center justify-between border-b p-4!">
        <CardTitle className="text-sm font-medium">Capital Inflows</CardTitle>
        <CardAction>
          <RangeMenu
            selectedRange={selectedRange}
            onSelectRange={setSelectedRange}
          />
        </CardAction>
      </CardHeader>

      {/* Content */}
      <CardContent className="relative p-0!">
        <GaugeGrid />

        <div className="relative px-5 pt-5 pb-4">
          <div className="relative mx-auto h-[158px] w-full max-w-[300px]">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full overflow-visible"
              initialDimension={{ width: 300, height: 158 }}
              role="img"
              aria-label={`Capital inflows for ${currentRange.label}: ${currentRange.total}`}
            >
              <PieChart
                accessibilityLayer
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <>
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium tabular-nums">
                            $
                            {Number(value).toLocaleString(undefined, {
                              maximumFractionDigits: 1,
                            })}
                            M
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Pie
                  data={currentRange.sources}
                  dataKey="amount"
                  nameKey="name"
                  startAngle={180}
                  endAngle={0}
                  cx="50%"
                  cy="93%"
                  innerRadius={84}
                  outerRadius={116}
                  paddingAngle={1}
                  cornerRadius={3}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                >
                  {currentRange.sources.map((source) => (
                    <Cell key={source.id} fill={`var(--color-${source.id})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="pointer-events-none absolute inset-x-0 top-[82px] flex flex-col items-center">
              <span className="text-muted-foreground text-xs">Capital In</span>
              <span className="text-2xl font-medium">{currentRange.total}</span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Separator className="mb-5" />
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
            {currentRange.sources.map((source, index) => (
              <div key={source.id} className="contents">
                <SourceMetric source={source} />
                {index < currentRange.sources.length - 1 ? (
                  <Separator orientation="vertical" className="mx-2" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}