// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import {
  Frame,
  FramePanel,
  FrameTitle,
} from "@ui/components/reui/frame"

import { Button } from "@ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import { adoptionRate, bars, getBarColor, maxBars } from "./data"
import { EllipsisVerticalIcon, SettingsIcon, TriangleAlertIcon, Pin, Share2Icon, ShieldCheckIcon } from "lucide-react"

export function Stats() {
  return (
    <Frame className="w-full sm:max-w-md">
      {/* Content */}
      <FramePanel>
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Feature Adoption</FrameTitle>
            <div className="text-muted-foreground text-sm font-medium">
              Best adoption report
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground -me-1.5"
                />
              }
            >
              <EllipsisVerticalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <SettingsIcon aria-hidden="true" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <TriangleAlertIcon aria-hidden="true" />
                  Export Report
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pin aria-hidden="true" />
                  Configure Alerts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Share2Icon aria-hidden="true" />
                  Run Manual Check
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShieldCheckIcon aria-hidden="true" />
                  View History
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-6">
          <div className="text-foreground text-5xl font-bold">
            {adoptionRate}
          </div>

          <div className="relative flex h-32 w-full items-end gap-2">
            {bars.map((height, i) => (
              <div
                key={i}
                className="flex min-w-0 flex-1 cursor-pointer flex-col justify-end transition-all"
              >
                {[...Array(maxBars)].map((_, j) => (
                  <div
                    key={j}
                    className={`my-0.5 h-3 rounded ${getBarColor(j, height)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}