import { OverviewTiles } from '@ui/compositions/detail/DetailKit'
import { SubTabState } from '@ui/compositions/detail/SubTabState'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { DetailTable } from '../shared/DetailTable'

export const CustomerUsageSummaryProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail/DetailKit', 'pages/shared/DetailTable'],
  note: "A customer's Analytics tab: the four summary tiles and the per-feature table the console uses elsewhere, over the customer's usage analytics.",
})

/** One feature's usage for the customer in the window. */
export interface CustomerUsageSummaryRow {
  id: string
  name: string
  /** The feature's lookup key, shown under its name. */
  lookupKey: string
  eventCount: number
  /** Already formatted with its unit, e.g. "12,400 calls". */
  usage: string
}

export interface CustomerUsageSummaryProps {
  /** e.g. "Last 30 days". */
  rangeLabel: string
  /** What the server says the usage is worth, formatted; null when it did not price it. */
  revenue: string | null
  eventCount: number
  rows: CustomerUsageSummaryRow[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

const count = (value: number) => new Intl.NumberFormat().format(value)

/**
 * The customer's analytics, in the console's existing grammar rather than a
 * layout of its own: four tiles, then the features that drove them.
 */
export function CustomerUsageSummary({
  rangeLabel,
  revenue,
  eventCount,
  rows,
  isLoading = false,
  error = null,
  onRetry,
}: CustomerUsageSummaryProps) {
  return (
    <div className="flex flex-col gap-5">
      <OverviewTiles
        tiles={[
          {
            label: 'Usage revenue',
            value: revenue ?? '—',
            detail: revenue ? rangeLabel : 'Not priced by Flexprice for this window',
          },
          { label: 'Events', value: isLoading ? '—' : count(eventCount), detail: rangeLabel },
          {
            label: 'Features used',
            value: isLoading ? '—' : count(rows.length),
            detail: 'With at least one event',
          },
          { label: 'Period', value: rangeLabel, detail: 'Daily buckets' },
        ]}
      />
      <Section table showTitle title="Usage by feature">
        <SubTabState
          hasData={rows.length > 0}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          columns={3}
          loadingLabel="Loading usage"
          empty={{
            scene: 'customers',
            title: 'No usage in this period',
            description: 'Events this customer sends appear here, by the feature that meters them.',
          }}
        >
          <DetailTable<CustomerUsageSummaryRow>
            compact
            label="Usage by feature"
            noun="features"
            rows={rows}
            columns={[
              {
                key: 'feature',
                header: 'Feature',
                sortBy: (row) => row.name,
                text: (row) => `${row.name} ${row.lookupKey}`,
                cell: (row) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{row.name}</span>
                    {row.lookupKey ? (
                      <span className="text-muted-foreground truncate font-mono text-xs">
                        {row.lookupKey}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'events',
                header: 'Events',
                sortBy: (row) => row.eventCount,
                cell: (row) => <span className="tabular-nums">{count(row.eventCount)}</span>,
              },
              {
                key: 'usage',
                header: 'Usage',
                cell: (row) => <span className="tabular-nums">{row.usage}</span>,
              },
            ]}
          />
        </SubTabState>
      </Section>
    </div>
  )
}
