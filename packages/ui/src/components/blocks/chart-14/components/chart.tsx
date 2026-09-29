// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { cn } from "cn"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@ui/primitives/avatar"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ui/primitives/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ui/primitives/tooltip"
import {
  allocationMemberCount,
  allocationMembers,
  allocationPeriods,
  SEGMENT_COUNT,
  type AllocationPeriod,
} from "./data"
import { InfoIcon } from "lucide-react"

const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => index)

function AllocationMeter({ period }: { period: AllocationPeriod }) {
  return (
    <div
      aria-label={`${period.label} portfolio allocation is ${period.allocation}`}
      className="flex h-7 w-full items-stretch justify-between"
      role="img"
    >
      {segments.map((segment) => (
        <span
          aria-hidden="true"
          key={segment}
          className={cn(
            "h-full w-1 shrink-0 rounded-full",
            segment < period.filledSegments ? "bg-success" : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}

function MemberStack() {
  return (
    <div className="flex items-center gap-2">
      <AvatarGroup className="-space-x-2">
        {allocationMembers.map((member) => (
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
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {allocationMemberCount} Members
      </span>
    </div>
  )
}

export function Chart() {
  return (
    <Tabs defaultValue={allocationPeriods[0].value} className="w-full max-w-md">
      <Card className="@container w-full gap-0 p-0 shadow-xs">
        <CardHeader className="grid-cols-1 flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
          <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span>Portfolio Allocation</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex shrink-0 rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      aria-label="Portfolio Allocation info"
                    />
                  }
                >
                  <InfoIcon className="size-3.5" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-56 px-2.5 py-1.5 text-xs leading-5"
                >
                  Allocation by selected period.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardAction className="col-start-1 row-span-1 row-start-2 justify-self-start @sm:col-start-2 @sm:row-start-1 @sm:justify-self-end">
            <TabsList>
              {allocationPeriods.map((period) => (
                <TabsTrigger key={period.value} value={period.value}>
                  {period.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardAction>
        </CardHeader>

        {allocationPeriods.map((period) => (
          <TabsContent key={period.value} value={period.value}>
            <CardContent className="flex flex-col gap-4 px-5 pt-5 pb-5">
              {/* Metric */}
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[26px] font-medium">
                  {period.allocation}
                </span>
                <span className="text-success text-xs font-medium">
                  {period.delta}
                </span>
                <span className="text-muted-foreground/70 text-xs">
                  {period.comparison}
                </span>
              </div>

              {/* Chart */}
              <AllocationMeter period={period} />

              {/* Footer */}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p>
                  <span className="text-muted-foreground/70 text-xs">
                    Equities Exposure:
                  </span>{" "}
                  <span className="text-sm font-medium">{period.exposure}</span>
                </p>
                <MemberStack />
              </div>
            </CardContent>
          </TabsContent>
        ))}
      </Card>
    </Tabs>
  )
}