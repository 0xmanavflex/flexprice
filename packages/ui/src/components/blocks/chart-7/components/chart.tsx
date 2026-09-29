// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { type CSSProperties } from "react"
import { Frame, FramePanel } from "@ui/components/reui/frame"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@ui/primitives/avatar"
import { Button } from "@ui/primitives/button"

import { arcMetrics, type ArcMetric, type MetricMember } from "./data"

const SEGMENT_COUNT_DEFAULT = 40
const ARC_START = 180
const ARC_SWEEP = 180

/** viewBox crop + CSS size: arc + stroke (~x 14-230, y 18-131 in full space). */
const ARC_VIEWBOX = { minX: 14, minY: 18, width: 216, height: 113 } as const

function SegmentedArcChart({ metric }: { metric: ArcMetric }) {
  const centerX = 122
  const centerY = 126
  const radius = 80
  const segmentLength = 23
  const segmentCount = metric.segmentCount ?? SEGMENT_COUNT_DEFAULT
  const angleStep = ARC_SWEEP / Math.max(segmentCount - 1, 1)

  const ticks = Array.from({ length: segmentCount }, (_, index) => {
    const radians = ((ARC_START + angleStep * index) * Math.PI) / 180
    return {
      x1: centerX + radius * Math.cos(radians),
      y1: centerY + radius * Math.sin(radians),
      x2: centerX + (radius + segmentLength) * Math.cos(radians),
      y2: centerY + (radius + segmentLength) * Math.sin(radians),
      active: index < metric.activeSegments,
    }
  })

  return (
    <div
      aria-label={`${metric.title}: ${metric.label} ${metric.value}`}
      className="relative shrink-0 overflow-hidden max-sm:mx-auto"
      role="img"
      style={{
        width: ARC_VIEWBOX.width,
        height: ARC_VIEWBOX.height,
      }}
    >
      <svg
        aria-hidden="true"
        className="relative z-10 h-full w-full"
        fill="none"
        viewBox={`${ARC_VIEWBOX.minX} ${ARC_VIEWBOX.minY} ${ARC_VIEWBOX.width} ${ARC_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Soft bloom behind the active ticks for a polished, lit feel. */}
        <g className="opacity-40 [filter:blur(2.5px)]">
          {ticks.map((tick, index) =>
            tick.active ? (
              <line
                key={index}
                stroke="var(--metric-segment-color)"
                strokeLinecap="round"
                strokeWidth={3}
                x1={tick.x1}
                x2={tick.x2}
                y1={tick.y1}
                y2={tick.y2}
              />
            ) : null
          )}
        </g>
        {ticks.map((tick, index) => (
          <line
            key={index}
            stroke={
              tick.active
                ? "var(--metric-segment-color)"
                : "var(--metric-segment-track)"
            }
            strokeLinecap="round"
            strokeWidth={2.5}
            x1={tick.x1}
            x2={tick.x2}
            y1={tick.y1}
            y2={tick.y2}
          />
        ))}
      </svg>
    </div>
  )
}

function MemberStack({ members }: { members: MetricMember[] }) {
  return (
    <AvatarGroup className="-space-x-2">
      {members.map((member) => (
        <Avatar key={member.name} className="size-6">
          {member.avatar ? (
            <AvatarImage src={member.avatar} alt={member.name} />
          ) : null}
          <AvatarFallback className="bg-background text-xs font-medium">
            {member.initials}
          </AvatarFallback>
        </Avatar>
      ))}
    </AvatarGroup>
  )
}

function MetricPanel({ metric }: { metric: ArcMetric }) {
  const style = {
    "--metric-segment-color": metric.segmentColor,
    "--metric-segment-track":
      metric.segmentTrackColor ??
      "color-mix(in oklch, var(--muted-foreground) 14%, transparent)",
  } as CSSProperties

  return (
    <FramePanel className="min-h-[204px] p-0!" style={style}>
      <div className="border-border/60 flex h-14 items-center justify-between gap-3 border-b px-4">
        <h3 className="text-foreground text-sm font-medium">{metric.title}</h3>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="text-foreground"
        >
          Details
        </Button>
      </div>

      <div className="grid min-h-[144px] grid-cols-[minmax(0,1fr)_auto] items-end gap-3 p-5 max-sm:grid-cols-1 max-sm:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              {metric.state}
            </p>
            <p className="text-muted-foreground text-xs">
              {metric.label}:{" "}
              <span className="text-foreground text-xs font-medium">
                {metric.value}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MemberStack members={metric.members} />
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {metric.audience}
            </span>
          </div>
        </div>

        <SegmentedArcChart metric={metric} />
      </div>
    </FramePanel>
  )
}

export function Chart() {
  return (
    <div className="@container w-full">
      <Frame className="w-full" spacing="xs">
        <div className="grid gap-1 @4xl:grid-cols-2">
          {arcMetrics.map((metric) => (
            <MetricPanel key={metric.title} metric={metric} />
          ))}
        </div>
      </Frame>
    </div>
  )
}