import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import { cn } from '@ui/lib/cn'
import type { ShellNavGroup } from './types'

/**
 * The section's own navigation, taking its treatment from
 * `@reui/app-shell-16`.
 *
 * A `bg-muted` panel where the *active* item is the one with a raised white
 * surface — the inverse of the usual "tint the selection" pattern, and the
 * reason the block reads as layered rather than flat.
 *
 * One deviation from the block: its labels use `text-muted-foreground` on this
 * `bg-muted` panel, which measures 4.34:1 and fails AA. Muted on muted is the
 * recurring version of this mistake — the token is tuned for the page
 * background, not for a surface that has already been tinted.
 */
export interface ShellNavProps {
  title: string
  groups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void
}

export function ShellNav({ title, groups, activeItemId, onNavigate }: ShellNavProps) {
  return (
    <aside
      aria-label={title}
      className="bg-muted dark:bg-background hidden w-60 shrink-0 flex-col overflow-hidden md:flex"
    >
      <div className="px-4 pt-5 pb-3">
        <p className="text-foreground/75 text-xs font-semibold tracking-wide uppercase">
          {title}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.title ? (
              <p className="text-foreground/75 px-2 pb-1 text-xs font-medium">{group.title}</p>
            ) : null}

            {group.items.map((item) => {
              const isActive = item.id === activeItemId
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'h-8 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal',
                    isActive
                      ? 'bg-background text-foreground hover:bg-background shadow-xs'
                      : 'text-foreground hover:bg-background/70',
                  )}
                >
                  {item.icon ? (
                    <span className="text-muted-foreground size-4 shrink-0 opacity-80 [&_svg]:size-4">
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                  {/*
                    `aria-hidden` because the count is already in the button's
                    accessible name — otherwise a screen reader hears a bare
                    number with no context.
                  */}
                  {item.count !== undefined ? (
                    <Badge variant="outline" size="sm" className="ml-auto" aria-hidden>
                      {item.count}
                    </Badge>
                  ) : null}
                </Button>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}
