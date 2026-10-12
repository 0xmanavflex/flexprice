import type { CustomerIntegration } from '@fp/domain'
import { INTEGRATION_LOGOS } from '@ui/assets/integrations'
import { cn } from '@ui/lib/cn'
import { CopyValue } from '../shared/CopyValue'

/**
 * The integration-tab logo square, small enough for a table cell and the
 * detail header. Same tray: white card, hairline border, the mark inset.
 */
export function IntegrationMark({
  integration,
  className,
}: {
  integration: CustomerIntegration
  /** Overrides the 28px tray, e.g. `size-6` for a table cell. */
  className?: string
}) {
  const src = INTEGRATION_LOGOS[integration.id]
  return (
    <span
      title={integration.name}
      className={cn(
        'bg-background dark:bg-foreground dark:text-background flex size-7 shrink-0 items-center justify-center rounded-lg border p-1 shadow-xs dark:border-transparent',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span aria-hidden className="text-[10px] font-medium">
          {integration.name.charAt(0)}
        </span>
      )}
      <span className="sr-only">{integration.name}</span>
    </span>
  )
}

export function IntegrationMarks({ integrations }: { integrations: CustomerIntegration[] }) {
  if (integrations.length === 0) return null
  return (
    <span className="flex items-center gap-1.5">
      {integrations.map((integration) => (
        <IntegrationMark key={integration.providerType} integration={integration} />
      ))}
    </span>
  )
}

/**
 * The list column: each provider's 24px logo, and its id at that provider as a
 * copy chip when the mapping carries one.
 */
export function IntegrationChips({ integrations }: { integrations: CustomerIntegration[] }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {integrations.map((integration) =>
        integration.providerEntityId ? (
          <CopyValue
            key={integration.providerType}
            variant="chip"
            value={integration.providerEntityId}
            label={`${integration.name} ID`}
            leading={
              <IntegrationMark integration={integration} className="size-6 rounded-md p-0.5" />
            }
            className="gap-1.5 pl-0.5"
          />
        ) : (
          <IntegrationMark
            key={integration.providerType}
            integration={integration}
            className="size-6 rounded-md p-0.5"
          />
        ),
      )}
    </span>
  )
}
