import type { Invoice } from '@fp/domain'
import { useContractJournal, useSubscriptionRevenue } from '@fp/query'
import { SubscriptionJournal } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { toListFailure } from '@/pages/shared/listFailure'

/** A contract's Journal entries tab: every line its revenue contract posted. */
export function SubscriptionJournalPanel({
  subscriptionId,
  invoices,
  onOpenInvoice,
}: {
  subscriptionId: string
  invoices: Invoice[] | undefined
  onOpenInvoice?: ((invoiceId: string) => void) | undefined
}) {
  const { environmentId } = useSession()
  // Shared with the Revenue tab's query: the same contract and POB names.
  const revenue = useSubscriptionRevenue(environmentId, subscriptionId)
  const journal = useContractJournal(environmentId, revenue.data?.contract)
  const failure = toListFailure(revenue.error ?? journal.error, 'journal entries')
  return (
    <SubscriptionJournal
      journal={journal.data}
      isLoading={revenue.isPending || (Boolean(revenue.data) && journal.isPending)}
      error={failure?.message}
      onRetry={() => void (revenue.error ? revenue.refetch() : journal.refetch())}
      obligationNames={Object.fromEntries(
        (revenue.data?.obligations ?? []).map((pob) => [pob.id, pob.name]),
      )}
      invoiceNumbers={Object.fromEntries(
        (invoices ?? []).map((invoice) => [invoice.id, invoice.number]),
      )}
      onOpenInvoice={onOpenInvoice}
    />
  )
}
