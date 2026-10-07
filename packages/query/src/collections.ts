import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { type Money, InvoiceStatus, PaymentStatus, isZeroMoney, money } from '@fp/domain'
import { toInvoice, type InvoiceWire } from './invoices'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * What customers owe, for the strip above the Payments list.
 *
 * The API has a per-customer invoice summary but no tenant-wide one, so this
 * reads the finalized invoices and adds up what is still unpaid. That is the
 * one place the product sums money the API did not: it is a reading aid for a
 * header, never an amount anyone is charged, and it is kept as exact decimal
 * strings so it cannot drift the way a float would.
 */
const PAGE = 100
/** Five pages of finalized invoices. Past it the figure is reported as a floor. */
const MAX_PAGES = 5

export interface CollectionsSummary {
  outstanding: Money | null
  overdue: Money | null
  unpaidCount: number
  overdueCount: number
  /** Invoices in a currency other than the one totalled above. */
  otherCurrencies: number
  /** True when there were more finalized invoices than were read. */
  isPartial: boolean
}

/** Adds exact decimals, in the smallest unit of the longest fraction seen. */
function addDecimals(values: readonly string[]): string {
  const scale = Math.max(0, ...values.map((value) => value.split('.')[1]?.length ?? 0))
  const total = values.reduce((sum, value) => {
    const [whole = '0', fraction = ''] = value.split('.')
    const negative = whole.startsWith('-')
    const digits = BigInt(`${whole.replace('-', '')}${fraction.padEnd(scale, '0')}`)
    return sum + (negative ? -digits : digits)
  }, 0n)
  const sign = total < 0n ? '-' : ''
  const text = (total < 0n ? -total : total).toString().padStart(scale + 1, '0')
  return scale === 0 ? `${sign}${text}` : `${sign}${text.slice(0, -scale)}.${text.slice(-scale)}`
}

export function summariseCollections(
  wires: readonly InvoiceWire[],
  isPartial = false,
  now?: Date,
): CollectionsSummary {
  const unpaid = wires
    .map((wire) => toInvoice(wire, now))
    .filter(
      (invoice) =>
        invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue,
    )
    .filter((invoice) => !isZeroMoney(invoice.amountRemaining))

  const counts = new Map<string, number>()
  for (const invoice of unpaid) {
    const code = invoice.amountRemaining.currency
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  // The currency most invoices are in leads; the rest are counted, not mixed in.
  const lead = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!lead) {
    return {
      outstanding: null,
      overdue: null,
      unpaidCount: 0,
      overdueCount: 0,
      otherCurrencies: 0,
      isPartial,
    }
  }

  const inLead = unpaid.filter((invoice) => invoice.amountRemaining.currency === lead)
  const late = inLead.filter(
    (invoice) =>
      invoice.status === InvoiceStatus.Overdue || invoice.paymentStatus === PaymentStatus.Failed,
  )
  return {
    outstanding: money(addDecimals(inLead.map((invoice) => invoice.amountRemaining.amount)), lead),
    overdue: money(addDecimals(late.map((invoice) => invoice.amountRemaining.amount)), lead),
    unpaidCount: inLead.length,
    overdueCount: late.length,
    otherCurrencies: unpaid.length - inLead.length,
    isPartial,
  }
}

async function fetchCollections(client: Flexprice): Promise<CollectionsSummary> {
  const wires: InvoiceWire[] = []
  let total = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await call(() =>
      client.invoices.queryInvoice({
        limit: PAGE,
        offset: page * PAGE,
        invoiceStatus: ['FINALIZED'],
        skipLineItems: true,
      } as never),
    )
    const items = (response.items ?? []) as InvoiceWire[]
    wires.push(...items)
    total = response.pagination?.total ?? wires.length
    if (items.length < PAGE || wires.length >= total) break
  }
  return summariseCollections(wires, wires.length < total)
}

export function useCollectionsSummary() {
  const client = useFlexprice()
  return useQuery({
    queryKey: [...queryKeys.invoices.all(), 'collections'] as const,
    queryFn: () => fetchCollections(client),
    staleTime: 60_000,
    // A header figure is not worth a retry storm; the list below surfaces a real outage.
    retry: false,
  })
}
