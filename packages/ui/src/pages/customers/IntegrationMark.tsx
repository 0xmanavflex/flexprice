import type { CustomerIntegration } from '@fp/domain'
import { INTEGRATION_LOGOS, INTEGRATION_LOGOS_DARK } from '@ui/assets/integrations'
import { cn } from '@ui/lib/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'

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
  const darkSrc = INTEGRATION_LOGOS_DARK[integration.id] ?? src
  return (
    <span
      title={integration.name}
      className={cn(
        'bg-background flex size-7 shrink-0 items-center justify-center rounded-lg border p-1 shadow-xs',
        className,
      )}
    >
      {src ? (
        <>
          <img src={src} alt="" className="max-h-full max-w-full object-contain dark:hidden" />
          <img src={darkSrc} alt="" className="hidden max-h-full max-w-full object-contain dark:block" />
        </>
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
 * The list column: each provider's 24px logo, side by side: a customer can be
 * mapped in several. Hover (or focus) a logo for the customer's id at that
 * provider; the cell itself carries no ids, so it stays narrow.
 */
export function IntegrationChips({
  integrations,
  entityLabel = 'customer',
}: {
  integrations: CustomerIntegration[]
  entityLabel?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {integrations.map((integration) => (
        <Tooltip key={integration.providerType}>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                aria-label={
                  integration.providerEntityId
                    ? `${integration.name} ${entityLabel} ID ${integration.providerEntityId}`
                    : integration.name
                }
                className="focus-visible:outline-ring rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            }
          >
            <IntegrationMark integration={integration} className="size-6 rounded-md p-0.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="block max-w-72 p-2.5">
            <p className="text-xs font-medium">{integration.name}</p>
            {integration.providerEntityId ? (
              <p className="mt-0.5 font-mono text-xs break-all opacity-80">
                {integration.providerEntityId}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  )
}
