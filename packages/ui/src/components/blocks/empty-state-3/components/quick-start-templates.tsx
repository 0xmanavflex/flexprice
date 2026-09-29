// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@ui/primitives/item"
import { KanbanIcon, ChevronRightIcon, TimerIcon } from "lucide-react"

export function QuickStartTemplates() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-muted-foreground text-sm">Quick starts</p>
      {/* Grid */}
      <div className="grid w-full gap-3 sm:grid-cols-2">
        <Item
          variant="outline"
          render={<a href="#" aria-label="Task board" />}
          className="hover:bg-muted/30 min-w-0 transition-colors"
        >
          <ItemMedia className="text-muted-foreground">
            <KanbanIcon className="size-3.5" aria-hidden="true" />
          </ItemMedia>

          <ItemContent className="min-w-0">
            <ItemTitle className="truncate">Task board</ItemTitle>
          </ItemContent>

          <ItemActions className="text-muted-foreground ml-auto">
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </ItemActions>
        </Item>

        <Item
          variant="outline"
          render={<a href="#" aria-label="Sprint tracker" />}
          className="hover:bg-muted/30 min-w-0 transition-colors"
        >
          <ItemMedia className="text-muted-foreground">
            <TimerIcon className="size-3.5" aria-hidden="true" />
          </ItemMedia>

          <ItemContent className="min-w-0">
            <ItemTitle className="truncate">Sprint tracker</ItemTitle>
          </ItemContent>

          <ItemActions className="text-muted-foreground ml-auto">
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </ItemActions>
        </Item>
      </div>
    </div>
  )
}