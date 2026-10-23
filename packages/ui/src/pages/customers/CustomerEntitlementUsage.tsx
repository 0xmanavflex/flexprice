import { SubTabState } from '@ui/compositions/detail/SubTabState'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { EntitlementUsageTable, type EntitlementUsageRow } from '../shared/EntitlementUsage'

export const CustomerEntitlementUsageProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/detail/SubTabState',
    'compositions/layout/Section',
    'pages/shared/EntitlementUsage',
  ],
  note: "A customer's entitlement usage on the Analytics tab, on the overview's EntitlementUsageTable so the two read every state the same way.",
})

/** One entitled feature's quota for the customer this period. */
export interface CustomerEntitlementUsageRow {
  id: string
  name: string
  /** `metered`, `static`, `boolean`, `config`. Only a metered feature has usage. */
  type: string
  /** Undefined when the API sent something unreadable — a dash, not a zero. */
  used: number | undefined
  /** Null when unlimited. */
  limit: number | null
  isEnabled: boolean
  resetsOn: Date | null
}

export interface CustomerEntitlementUsageProps {
  rows: CustomerEntitlementUsageRow[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  locale?: string
}

/**
 * The customer's entitlements on the Analytics tab.
 *
 * The table is the overview's `EntitlementUsageTable`, so the two tabs agree on
 * every state: an unlimited allowance reads "Unlimited" with no bar, an
 * over-limit one turns red, a boolean reads "Included". This adds only the
 * Analytics frame around it — the titled section and the loading, empty and
 * failed states.
 */
export function CustomerEntitlementUsage({
  rows,
  isLoading = false,
  error = null,
  onRetry,
  locale,
}: CustomerEntitlementUsageProps) {
  return (
    <Section table showTitle title="Usage">
      <SubTabState
        hasData={rows.length > 0}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        columns={4}
        loadingLabel="Loading usage"
        empty={{
          scene: 'customers',
          title: 'No entitlements yet',
          description: 'Quotas appear here once this customer is on a plan that grants a feature.',
        }}
      >
        <EntitlementUsageTable rows={rows.map(toTableRow)} locale={locale} />
      </SubTabState>
    </Section>
  )
}

function toTableRow(row: CustomerEntitlementUsageRow): EntitlementUsageRow {
  return {
    id: row.id,
    feature: row.name,
    featureType: row.type,
    enabled: row.isEnabled,
    limit: row.limit,
    used: row.used,
    resetsOn: row.resetsOn,
  }
}
