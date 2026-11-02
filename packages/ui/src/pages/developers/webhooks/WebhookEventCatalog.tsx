import { useMemo, useState } from 'react'
import { SearchIcon } from '@ui/icons'
import { type WebhookEventType, groupWebhookEventTypes } from '@fp/domain'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { ErrorState, type ErrorKind } from '@ui/compositions/feedback/States'
import { Section } from '@ui/compositions/layout/Section'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'
import { statusTone } from '../../shared/statusTones'

/**
 * The Event Catalog: every event type an endpoint can subscribe to.
 *
 * Svix's layout: the groups down the left with their counts, the selected
 * group's event types on the right, each with its description and the example
 * payload registered with its schema. An event type with no example says so
 * rather than showing an empty block: that is also why "Send example" fails
 * for it on the Testing tab.
 */
export const WebhookEventCatalogProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input-group',
    'compositions/Section',
    'compositions/EmptyState',
    'compositions/feedback/States',
    'reui/code-block',
  ],
  note: 'Svix event catalog: grouped rail, event types with description and example payload.',
})

export interface WebhookEventCatalogProps {
  eventTypes: WebhookEventType[]
  isLoading?: boolean
  error?: string | null
  errorKind?: ErrorKind | undefined
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
}

export function WebhookEventCatalog({
  eventTypes,
  isLoading = false,
  error = null,
  errorKind,
  onRetry,
  isRetrying,
}: WebhookEventCatalogProps) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  const groups = useMemo(() => groupWebhookEventTypes(eventTypes), [eventTypes])
  const term = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const inGroup = group
      ? (groups.find((entry) => entry.name === group)?.eventTypes ?? [])
      : eventTypes
    return term
      ? inGroup.filter(
          (eventType) =>
            eventType.name.toLowerCase().includes(term) ||
            eventType.description.toLowerCase().includes(term),
        )
      : inGroup
  }, [eventTypes, groups, group, term])

  if (error) {
    return (
      <ErrorState
        title="The event catalog could not be loaded"
        description={error}
        {...(errorKind ? { kind: errorKind } : {})}
        {...(onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
      />
    )
  }

  if (!isLoading && eventTypes.length === 0) {
    return (
      <EmptyState
        scene="developers"
        size="inline"
        title="No event types yet"
        description="Event types appear here once Flexprice registers them for this environment."
      />
    )
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Event groups" className="flex flex-col gap-3 lg:sticky lg:top-0">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter event types"
            placeholder="Filter events…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        <ul className="flex flex-col gap-0.5">
          {[
            { name: null as string | null, count: eventTypes.length },
            ...groups.map((entry) => ({
              name: entry.name as string | null,
              count: entry.eventTypes.length,
            })),
          ].map((entry) => {
            const active = entry.name === group
            return (
              <li key={entry.name ?? '__all'}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setGroup(entry.name)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <span className="truncate">{entry.name ?? 'All events'}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{entry.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-32 w-full" />)
        ) : visible.length === 0 ? (
          <EmptyState
            scene="developers"
            size="inline"
            isFiltered
            title="No event types match"
            description="Try another group, or clear the filter."
          />
        ) : (
          visible.map((eventType) => (
            <Section
              key={eventType.name}
              as="h3"
              title={eventType.name}
              {...(eventType.description ? { description: eventType.description } : {})}
              {...(eventType.deprecated
                ? { actions: <Pill tone={statusTone('deprecated')}>Deprecated</Pill> }
                : {})}
            >
              {eventType.example === null ? (
                <p className="text-muted-foreground text-sm">
                  No example payload is registered for this event type.
                </p>
              ) : (
                <CodeBlock
                  code={JSON.stringify(eventType.example, null, 2)}
                  language="json"
                  label={`Example payload, ${eventType.name}`}
                >
                  <CodeBlockHeader>
                    <CodeBlockTitle>Example payload</CodeBlockTitle>
                    <CodeBlockCopyButton className="ml-auto" />
                  </CodeBlockHeader>
                </CodeBlock>
              )}
            </Section>
          ))
        )}
      </div>
    </div>
  )
}
