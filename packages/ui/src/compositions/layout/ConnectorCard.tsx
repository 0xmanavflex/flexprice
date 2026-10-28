import type { ReactNode } from 'react'
import { ArrowUpRightIcon, CheckIcon, SettingsIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Badge } from '@ui/components/reui/badge'
import { cn } from '@ui/lib/cn'

export interface ConnectorCardProps {
  name: string
  description: string
  logo: ReactNode
  docsUrl?: string | undefined
  connected: boolean
  onConnect: () => void
  onConfigure: () => void
  /** The connected action's label; "Configure" by default. */
  configureLabel?: string
  /** Under the description, e.g. the connections it holds. */
  children?: ReactNode
  testId?: string
  className?: string
}

/**
 * A connector: a muted tray holding a white card (logo, name, description,
 * docs link), with one action in the tray footer. Unconnected shows Connect;
 * connected shows a green Connected chip and Configure, where disconnecting lives.
 * Purely presentational; every action is a prop.
 */
export function ConnectorCard({
  name,
  description,
  logo,
  docsUrl,
  connected,
  onConnect,
  onConfigure,
  configureLabel = 'Configure',
  children,
  testId,
  className,
}: ConnectorCardProps) {
  return (
    <article
      data-testid={testId}
      className={cn('bg-muted/50 flex flex-col rounded-xl border p-1', className)}
    >
      <div className="bg-background flex flex-1 flex-col gap-4 rounded-lg border p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-lg border p-1.5 shadow-xs">
            {logo}
          </span>
          {docsUrl ? (
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Setup guide for ${name}`}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <ArrowUpRightIcon className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{name}</h3>
          {/* Two lines at most, so every card in a row is the same height. */}
          <p className="text-muted-foreground line-clamp-2 text-[13px]/relaxed" title={description}>
            {description}
          </p>
        </div>
        {children}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        {connected ? (
          <>
            <Badge variant="success-light">
              <CheckIcon aria-hidden="true" />
              Connected
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-7 px-2"
              aria-label={`${configureLabel} ${name}`}
              onClick={onConfigure}
            >
              <SettingsIcon aria-hidden="true" />
              {configureLabel}
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground text-[13px]">Not connected</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5"
              aria-label={`Connect ${name}`}
              onClick={onConnect}
            >
              Connect
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
