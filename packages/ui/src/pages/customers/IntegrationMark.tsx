import type { CustomerIntegration } from '@fp/domain'
import { INTEGRATION_LOGOS } from '@ui/assets/integrations'

/**
 * The integration-tab logo square, small enough for a table cell and the
 * detail header. Same tray: white card, hairline border, the mark inset.
 */
export function IntegrationMark({ integration }: { integration: CustomerIntegration }) {
  const src = INTEGRATION_LOGOS[integration.id]
  return (
    <span
      title={integration.name}
      className="bg-background dark:bg-foreground dark:text-background flex size-7 shrink-0 items-center justify-center rounded-lg border p-1 shadow-xs dark:border-transparent"
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
