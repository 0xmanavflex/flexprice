import { useMemo, useState } from 'react'
import { SearchIcon } from '@ui/icons'
import { connectionForEntity, effectiveEntityId, type Integration } from '@fp/domain'
import { ConnectorCard, type ConnectorCardConnection } from '@ui/compositions/layout/ConnectorCard'
import { Button } from '@ui/components/primitives/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { INTEGRATION_LOGOS, INTEGRATION_LOGOS_DARK } from '@ui/assets/integrations'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import {
  EMPTY_CATALOGUE,
  filterMissCopy,
  searchMissCopy,
} from '@ui/compositions/feedback/emptyCatalogue'
import { Bone, SkeletonRegion } from '@ui/compositions/feedback/Skeletons'
import { ErrorState, type ErrorKind } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import type { ListBillingEntity } from '../shared/billingEntityColumn'

/**
 * The integrations gallery. The `settings-13` block is kept verbatim in
 * `components/blocks/settings-13`; the live page renders its layout (heading
 * and three-up grid) with the real catalogue through `ConnectorCard`.
 *
 * Connection state is real (`connections.length > 0`). Connect and Configure are
 * callbacks: the page opens the connect or manage sheet, so this block holds no
 * connection state of its own.
 *
 * The page's query state is its own to show: loading is a grid of card-shaped
 * placeholders, a failure is an `ErrorState` with a retry, an empty catalogue
 * is the first-run state, and a search or category that matches nothing is a
 * filtered miss with a way out: four different answers, not one line.
 */
export const IntegrationsBlockProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/ConnectorCard',
    'compositions/feedback/EmptyState',
    'compositions/feedback/Skeletons',
    'compositions/feedback/States',
  ],
  note: 'The settings-13 gallery layout over the live catalogue, with loading, error, first-run and filtered-empty states. Connect and Configure are callbacks.',
})

const ALL = 'All'

export interface IntegrationsFailure {
  message: string
  canRetry: boolean
  kind?: ErrorKind | undefined
  retryAfterMs?: number | undefined
}

export interface IntegrationsBlockProps {
  integrations: Integration[]
  /** The catalogue is on its first request. */
  isLoading?: boolean
  /** The catalogue request failed. Shown in place of the gallery when there is nothing to show. */
  error?: IntegrationsFailure | null
  /** Open the connect flow for an unconnected integration. */
  onConnect?: ((integration: Integration) => void) | undefined
  /**
   * Open the manage sheet for a connected integration, or, with `entities`,
   * its provider page.
   */
  onConfigure?: ((integration: Integration) => void) | undefined
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
  /**
   * The environment's billing entities, given only while they are enabled: a
   * connected card then lists its connections by entity and the entities that
   * lack one.
   */
  entities?: readonly ListBillingEntity[] | undefined
}

/** A connected provider's connections with their entities, and one line per entity without one. */
function entityConnections(
  integration: Integration,
  entities: readonly ListBillingEntity[],
): ConnectorCardConnection[] {
  const nameOf = (id: string) => entities.find((entity) => entity.id === id)?.name
  const owned = integration.connections.map((connection) => ({
    id: connection.id,
    label: connection.name,
    entity: nameOf(effectiveEntityId(connection, entities)) ?? '—',
  }))
  const missing = entities
    .filter((entity) => !connectionForEntity(integration, entity.id, entities))
    .map((entity) => ({
      id: entity.id,
      label: `${entity.name} has no ${integration.name} account`,
      missing: true,
    }))
  return [...owned, ...missing]
}

function GallerySkeleton() {
  return (
    <SkeletonRegion
      label="Loading integrations"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="bg-muted/50 flex flex-col rounded-xl border p-1">
          <div className="bg-background flex flex-col gap-4 rounded-lg border p-5">
            <Bone className="size-12 rounded-lg" />
            <div className="space-y-2">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3.5 w-4/5" />
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <Bone className="h-4 w-24" />
            <Bone className="h-7 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/**
 * The provider's logo, or its initial when there is none. The colour mark
 * shows in light mode and its white version in dark mode.
 */
export function IntegrationLogo({ integration }: { integration: Integration }) {
  const src = INTEGRATION_LOGOS[integration.id]
  const darkSrc = INTEGRATION_LOGOS_DARK[integration.id] ?? src
  return src ? (
    <>
      <img src={src} alt="" className="max-h-full max-w-full object-contain dark:hidden" />
      <img src={darkSrc} alt="" className="hidden max-h-full max-w-full object-contain dark:block" />
    </>
  ) : (
    <span aria-hidden className="text-base font-medium">
      {integration.name.charAt(0)}
    </span>
  )
}

export function IntegrationsBlock({
  integrations,
  isLoading = false,
  error = null,
  onConnect,
  onConfigure,
  onRetry,
  isRetrying,
  entities,
}: IntegrationsBlockProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)

  const listed = useMemo(() => integrations.filter((i) => !i.premium), [integrations])
  const options = useMemo(
    () =>
      [ALL, ...[...new Set(listed.flatMap((i) => i.categories))].sort()].map((value) => ({
        value,
        label: value,
        count:
          value === ALL ? listed.length : listed.filter((i) => i.categories.includes(value)).length,
      })),
    [listed],
  )

  const visible = integrations.filter((i) => {
    if (i.premium) return false
    if (category !== ALL && !i.categories.includes(category)) return false
    const needle = query.trim().toLowerCase()
    return needle === '' || `${i.name} ${i.description}`.toLowerCase().includes(needle)
  })
  const isConnected = (i: Integration) => i.connections.length > 0
  const connected = visible.filter(isConnected)
  const available = visible.filter((i) => !isConnected(i))

  const renderCard = (integration: Integration) => (
    <ConnectorCard
      key={integration.id}
      testId={`integration-${integration.id}`}
      name={integration.name}
      description={integration.description}
      docsUrl={integration.docsUrl}
      logo={<IntegrationLogo integration={integration} />}
      connected={isConnected(integration)}
      onConnect={() => onConnect?.(integration)}
      onConfigure={() => onConfigure?.(integration)}
      configureLabel={entities && isConnected(integration) ? 'Manage' : undefined}
      connections={
        entities && isConnected(integration) ? entityConnections(integration, entities) : undefined
      }
    />
  )

  const grid = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
  const filtered = category !== ALL || query !== ''
  const clearFilters = () => {
    setCategory(ALL)
    setQuery('')
  }

  const failure =
    error === null ? null : (
      <ErrorState
        title={error.message}
        variant={listed.length === 0 ? 'page' : 'panel'}
        {...(error.kind ? { kind: error.kind } : {})}
        {...(error.canRetry && onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
        {...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {})}
      />
    )

  // Nothing to show yet, or nothing that could be shown: the gallery chrome
  // (search, category) would have nothing to act on.
  if (error !== null && listed.length === 0) {
    return <div className="px-10 pt-8 pb-16 2xl:px-14">{failure}</div>
  }
  if (isLoading && listed.length === 0) {
    return (
      <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
        <GallerySkeleton />
      </div>
    )
  }
  if (listed.length === 0) {
    const copy = EMPTY_CATALOGUE.integrations
    return (
      <div className="px-10 pt-8 pb-16 2xl:px-14">
        <EmptyState title={copy.title} description={copy.description} figure={copy.figure} />
      </div>
    )
  }

  const miss = query.trim() ? searchMissCopy(query) : filterMissCopy('integrations')

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      {failure}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-72">
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search integrations…"
            aria-label="Search integrations"
          />
        </InputGroup>
        <Select
          items={options}
          value={category}
          onValueChange={(next) => setCategory((next as string | null) ?? ALL)}
        >
          <SelectTrigger
            className="h-9! w-52 justify-start gap-2 pl-3 [&>svg]:ml-auto"
            aria-label="Category"
          >
            <span className="text-muted-foreground">Category</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                <span className="text-muted-foreground ml-auto pl-4 tabular-nums">
                  {option.count}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-9"
            onClick={clearFilters}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {connected.length > 0 ? (
        <section aria-labelledby="integrations-connected" className="space-y-3">
          <h2 id="integrations-connected" className="text-sm font-medium">
            Connected
          </h2>
          <div className={grid}>{connected.map(renderCard)}</div>
        </section>
      ) : null}

      <section aria-labelledby="integrations-available" className="space-y-3">
        <h2 id="integrations-available" className="text-sm font-medium">
          Available
        </h2>
        {available.length > 0 ? (
          <div className={grid}>{available.map(renderCard)}</div>
        ) : filtered ? (
          <EmptyState
            size="inline"
            isFiltered
            title={miss.title}
            {...(miss.description ? { description: miss.description } : {})}
            figure={EMPTY_CATALOGUE.search.figure}
            onClearFilters={
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Everything available is already connected.
          </p>
        )}
      </section>
    </div>
  )
}
