import type { ReactNode } from 'react'
import { ArrowUpRightIcon, PlugIcon, SettingsIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Switch } from '@ui/components/primitives/switch'
import { cn } from '@ui/lib/cn'

export interface ConnectorCardProps {
  name: string
  description: string
  logo: ReactNode
  docsUrl?: string | undefined
  connected: boolean
  /** Whether the on/off switch is on (an enabled connector can be paused). */
  enabled: boolean
  onConnect: () => void
  onDisconnect: () => void
  onConfigure: () => void
  onEnabledChange: (enabled: boolean) => void
  testId?: string
  className?: string
}

/**
 * A connector: a muted tray holding a white card (logo, name, description,
 * docs link), with the actions in the tray footer — Connect/Disconnect,
 * Configure, and an on/off switch. The reference's connector card, markup for
 * markup. Purely presentational; every action is a prop.
 */
export function ConnectorCard({
  name,
  description,
  logo,
  docsUrl,
  connected,
  enabled,
  onConnect,
  onDisconnect,
  onConfigure,
  onEnabledChange,
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
          <span className="bg-background dark:bg-foreground dark:text-background flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 border shadow-xs dark:border-transparent">
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
          <p className="text-muted-foreground text-[13px]/relaxed">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        {connected ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5"
              onClick={onDisconnect}
            >
              Disconnect
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-7 px-2"
              aria-label={`Configure ${name}`}
              onClick={onConfigure}
            >
              <SettingsIcon aria-hidden="true" />
              Configure
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" className="h-7 px-2.5" onClick={onConnect}>
            <PlugIcon aria-hidden="true" />
            Connect
          </Button>
        )}
        <Switch
          checked={connected && enabled}
          disabled={!connected}
          aria-label={`${name} enabled`}
          onCheckedChange={onEnabledChange}
        />
      </div>
    </article>
  )
}
