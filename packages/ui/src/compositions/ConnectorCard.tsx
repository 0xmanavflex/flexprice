import type { ReactNode } from 'react'
import { ArrowUpRightIcon, PlugZapIcon, Settings2Icon } from 'lucide-react'
import { Button, buttonVariants } from '@ui/components/primitives/button'
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
 * Configure, and an on/off switch. Purely presentational; every action is a prop.
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
    <div
      data-testid={testId}
      className={cn('bg-muted/50 flex flex-col gap-1 rounded-xl p-1', className)}
    >
      <div className="bg-card border-border/70 flex flex-1 flex-col gap-4 rounded-lg border p-4 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="bg-muted/60 flex size-11 shrink-0 items-center justify-center rounded-lg border">
            {logo}
          </div>
          {docsUrl ? (
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Setup guide for ${name}`}
              className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            >
              <ArrowUpRightIcon className="opacity-60" aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{name}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 p-1.5">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={connected ? 'outline' : 'default'}
            onClick={connected ? onDisconnect : onConnect}
          >
            {connected ? null : <PlugZapIcon aria-hidden="true" />}
            {connected ? 'Disconnect' : 'Connect'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!connected}
            aria-label={`Configure ${name}`}
            onClick={onConfigure}
          >
            <Settings2Icon aria-hidden="true" />
            Configure
          </Button>
        </div>
        <Switch
          checked={connected && enabled}
          disabled={!connected}
          aria-label={`${name} enabled`}
          onCheckedChange={onEnabledChange}
        />
      </div>
    </div>
  )
}
