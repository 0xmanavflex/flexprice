import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/primitives/popover'
import { ScrollArea } from '@ui/primitives/scroll-area'
import { Separator } from '@ui/primitives/separator'
import { Skeleton } from '@ui/primitives/skeleton'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { ShellNotification } from './types'

/**
 * Notifications, from `@reui/app-shell-3`'s popover.
 *
 * Reduced to what a billing console actually has to say — a payment failed, an
 * export finished, a sync broke — so an item is a line of text and a time, not
 * the block's avatars, progress rings and meta badges.
 *
 * All four states are here because this is the one surface guaranteed to be on
 * screen during an incident. A bell that silently shows nothing when its own
 * request failed is worse than no bell: it asserts "all clear" on no evidence.
 */
export const ShellNotificationsProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-3', 'ui/popover', 'ui/button', '@reui/badge', 'ui/scroll-area'],
  note: "The block's notifications-popover, with its item reduced to text and time, and its states real.",
})

export interface ShellNotificationsProps {
  notifications: ShellNotification[]
  isLoading?: boolean
  /** Non-null means the fetch failed; the bell says so rather than showing zero. */
  error?: { message: string } | null
  onMarkAllRead?: () => void
  onViewAll?: () => void
  onOpenNotification?: (id: string) => void
}

function Panel({
  notifications,
  isLoading,
  error,
  onMarkAllRead,
  onViewAll,
  onOpenNotification,
}: ShellNotificationsProps) {
  const unread = notifications.filter((n) => n.unread).length

  return (
    <>
      <div className="border-border/40 flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <Badge size="sm" className="rounded-full!">
              {unread}
            </Badge>
          ) : null}
        </div>
        {unread > 0 && onMarkAllRead ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-60 hover:opacity-100"
            aria-label="Mark all as read"
            onClick={onMarkAllRead}
          >
            <CheckCheckIcon aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-24">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading notifications</span>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          // Stated, not swallowed. An empty list here would read as "nothing
          // has happened", which is a different claim from "we could not ask".
          <p role="alert" className="text-muted-foreground px-4 py-6 text-sm">
            Notifications could not be loaded. {error.message}
          </p>
        ) : notifications.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">You are all caught up.</p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <ul className="flex flex-col">
              {notifications.map((notification, index) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onOpenNotification?.(notification.id)}
                    className="hover:bg-accent/50 focus-visible:ring-ring flex w-full flex-col items-start gap-1 px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="flex w-full items-start gap-2">
                      {notification.unread ? (
                        <span
                          aria-hidden
                          className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                        />
                      ) : null}
                      <span
                        className={cn(
                          'min-w-0 text-sm',
                          notification.unread ? 'font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {notification.title}
                        {notification.unread ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                    </span>
                    {notification.description ? (
                      <span className="text-muted-foreground line-clamp-2 text-xs">
                        {notification.description}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">{notification.timestamp}</span>
                  </button>
                  {index < notifications.length - 1 ? (
                    <Separator className="opacity-60" />
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      {onViewAll ? (
        <div className="border-border/60 border-t px-2 py-1">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onViewAll}>
            View all notifications
          </Button>
        </div>
      ) : null}
    </>
  )
}

export function ShellNotifications(props: ShellNotificationsProps) {
  const { notifications, isLoading, error } = props
  const unread = notifications.filter((n) => n.unread).length
  // No dot while loading and none on failure: the dot is a claim about what is
  // waiting, and neither state knows.
  const showsDot = !isLoading && !error && unread > 0

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative [&_svg]:opacity-60 [&_svg]:hover:opacity-100"
            aria-label={
              showsDot ? `Notifications, ${unread} unread` : 'Notifications'
            }
          />
        }
      >
        <BellIcon aria-hidden />
        {showsDot ? (
          <span aria-hidden className="bg-primary absolute top-0.5 right-1 size-1.5 rounded-full" />
        ) : null}
      </PopoverTrigger>

      {/* A `role="dialog"` with no accessible name announces only "dialog". */}
      <PopoverContent
        aria-label="Notifications"
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 gap-0 p-0"
      >
        <Panel {...props} />
      </PopoverContent>
    </Popover>
  )
}
