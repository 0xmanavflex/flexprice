import { BookOpenIcon } from 'lucide-react'
import type { Integration } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Frame, FrameFooter, FramePanel } from '@ui/components/reui/frame'
import { ErrorState } from '@ui/compositions/States'
import { buttonVariants } from '@ui/primitives/button'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@ui/primitives/item'
import { Skeleton } from '@ui/primitives/skeleton'
import { provenance } from '@ui/provenance'

/**
 * The Integrations page: one ReUI `settings-13` card per provider (`Frame`,
 * `FramePanel` with an `Item`, `FrameFooter`), in a three-column grid.
 *
 * Read-only for now — the card says whether the environment has a published
 * connection and links to the setup docs; connecting is not built.
 */
export const IntegrationGridProvenance = provenance({
  source: 'reui',
  registry: ['@reui/settings-13'],
  note: 'ReUI settings-13 integration cards; monogram tile in place of a hotlinked logo.',
})

function IntegrationCard({ integration }: { integration: Integration }) {
  const connected = integration.connections > 0
  return (
    <Frame data-testid={`integration-${integration.id}`}>
      <FramePanel>
        <Item className="p-0">
          <ItemMedia variant="icon" aria-hidden className="size-10 text-sm font-semibold">
            {integration.name.slice(0, 2).toUpperCase()}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{integration.name}</ItemTitle>
            <span className="text-muted-foreground text-xs">{integration.categories.join(' · ')}</span>
          </ItemContent>
        </Item>
        <ItemDescription className="mt-3 line-clamp-none">{integration.description}</ItemDescription>
      </FramePanel>
      <FrameFooter className="flex items-center justify-between gap-2">
        {connected ? (
          <Badge variant="success-light">
            {integration.connections > 1 ? `Connected (${integration.connections})` : 'Connected'}
          </Badge>
        ) : (
          <Badge variant="outline">{integration.premium ? 'Premium' : 'Not connected'}</Badge>
        )}
        {integration.docsUrl ? (
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <BookOpenIcon aria-hidden className="size-4" />
            Setup guide
            <span className="sr-only"> for {integration.name}</span>
          </a>
        ) : null}
      </FrameFooter>
    </Frame>
  )
}

function Cards({ integrations }: { integrations: Integration[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
      {integrations.map((integration) => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
    </div>
  )
}

export interface IntegrationGridProps {
  integrations: Integration[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function IntegrationGrid({ integrations, isLoading = false, error = null, onRetry }: IntegrationGridProps) {
  if (error) {
    return <ErrorState title="Couldn't load integrations" description={error} {...(onRetry ? { onRetry } : {})} />
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3" aria-busy="true">
        <span className="sr-only">Loading integrations</span>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    )
  }

  const standard = integrations.filter((i) => !i.premium)
  const premium = integrations.filter((i) => i.premium)
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Integrations">
        <Cards integrations={standard} />
      </section>
      {premium.length > 0 ? (
        <section aria-labelledby="premium-integrations" className="flex flex-col gap-3">
          <h2 id="premium-integrations" className="text-sm font-medium">
            Premium add-ons
          </h2>
          <Cards integrations={premium} />
        </section>
      ) : null}
    </div>
  )
}
