// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import {
  Frame,
  FramePanel,
  FrameTitle,
} from "@ui/components/reui/frame"

import { Button } from "@ui/primitives/button"
import { Progress } from "@ui/primitives/progress"

import { renewalDate, total, used } from "./data"

export function Stats() {
  const remaining = total - used
  const percent = (used / total) * 100

  return (
    <Frame className="w-full sm:max-w-md">
      {/* Content */}
      <FramePanel>
        <div className="mb-6 flex items-center justify-between gap-3">
          <FrameTitle>API Call Quota</FrameTitle>
          <Button variant="outline" size="sm" className="h-8! font-medium">
            View API usage
          </Button>
        </div>

        <div className="flex flex-col space-y-6">
          <div className="grow space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Used calls:{" "}
                <span className="text-foreground font-semibold">{used}</span>
              </span>
              <span className="text-foreground text-base font-semibold">
                ${(used * 0.002).toFixed(2)}
              </span>
            </div>

            <Progress
              value={percent}
              className="**:data-[slot=progress-track]:h-2"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-600">
                {remaining} free calls left
              </span>
              <span className="text-muted-foreground text-xs">
                of {total} monthly quota
              </span>
            </div>
          </div>

          <div className="border-input text-muted-foreground flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm">
            <span>Quota renews on</span>
            <span className="text-foreground font-medium">{renewalDate}</span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}