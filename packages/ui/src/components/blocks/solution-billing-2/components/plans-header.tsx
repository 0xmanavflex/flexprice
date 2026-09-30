"use client"

import { PlusIcon } from "lucide-react"
import { Badge } from "@ui/components/reui/badge"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/primitives/avatar"
import { Button } from "@ui/primitives/button"

import { DotSeparator } from "./dot-separator"

// Content-level plans header (not a sticky layout navbar). Left: page title,
// live plan count badge, catalog meta, and the last editor. Right: new plan.

interface PlansHeaderProps {
  liveCount: number
  metaLabel: string
  editorName: string
  editorAvatar: string
  editedAt: string
  onCreatePlan: () => void
}

export function PlansHeader({
  liveCount,
  metaLabel,
  editorName,
  editorAvatar,
  editedAt,
  onCreatePlan,
}: PlansHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: page identity + live plan count */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-foreground text-lg leading-tight font-semibold tracking-tight">
            Plans
          </h2>
          <Badge variant="success-light">{liveCount} live</Badge>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>{metaLabel}</span>
          <DotSeparator />
          <span className="flex items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarImage src={editorAvatar} alt="" />
              <AvatarFallback className="text-[9px]">
                {editorName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <span>{editorName}</span>
            <DotSeparator />
            <span>{editedAt}</span>
          </span>
        </div>
      </div>

      {/* Right: create plan */}
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" onClick={onCreatePlan}>
          <PlusIcon
            aria-hidden="true"
          />
          New plan
        </Button>
      </div>
    </div>
  )
}