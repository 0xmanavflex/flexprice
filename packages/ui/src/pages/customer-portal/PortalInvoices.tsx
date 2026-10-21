import { useState } from 'react'
import { type PortalInvoice, type PortalInvoiceStatus, isPayable } from '@fp/domain'
import { DownloadIcon, MoreHorizontalIcon, SearchIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { formatDate, formatRange } from './format'
import { InvoiceStatusPill, Loaded, PortalEmpty } from './parts'
import type { CustomerPortalData } from './types'

/** Every invoice, newest first: search, a status filter, and pay or download per row. */
export const PortalInvoicesProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/detail/DetailKit',
    'primitives/input-group',
    'primitives/select',
    'primitives/dropdown-menu',
    'shared/Money',
  ],
  note: 'Customer portal invoices list, after the reference portal.',
})

type Filter = 'all' | 'unpaid' | 'paid'

const FILTER_LABEL: Record<Filter, string> = { all: 'All invoices', unpaid: 'Unpaid', paid: 'Paid' }

const UNPAID: ReadonlySet<PortalInvoiceStatus> = new Set([
  'open',
  'overdue',
  'failed',
  'processing',
])

export interface PortalInvoicesProps {
  data: CustomerPortalData
  locale: string | undefined
  onOpen: (invoice: PortalInvoice) => void
  onPay: (invoice: PortalInvoice) => void
  onDownload: (invoice: PortalInvoice) => void
}

export function PortalInvoices({ data, locale, onOpen, onPay, onDownload }: PortalInvoicesProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label="Invoices">
      <Loaded load={data.invoices} label="invoices" rows={6}>
        {(invoices) => {
          if (invoices.length === 0) {
            return (
              <PortalEmpty
                title="No invoices yet"
                description="Invoices appear here once your first billing period closes."
              />
            )
          }
          const needle = query.trim().toLowerCase()
          const shown = invoices.filter(
            (i) =>
              (filter === 'all' ||
                (filter === 'unpaid' ? UNPAID.has(i.status) : i.status === 'paid')) &&
              (!needle || i.number.toLowerCase().includes(needle)),
          )
          return (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
                <InputGroup className="h-9 w-full sm:w-72">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Search invoice number"
                    aria-label="Search invoices"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                <Select
                  value={filter}
                  onValueChange={(value) => value !== null && setFilter(value as Filter)}
                >
                  <SelectTrigger className="h-9 w-40" aria-label="Status">
                    <SelectValue>{(value) => FILTER_LABEL[value as Filter]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {FILTER_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {shown.length === 0 ? (
                <PortalEmpty
                  title="No matching invoices"
                  description="Try another invoice number or status."
                />
              ) : (
                <SimpleTable
                  rows={shown}
                  onRowClick={onOpen}
                  columns={[
                    {
                      key: 'number',
                      header: 'Invoice',
                      className: 'font-medium',
                      // The row is clickable; the number is the keyboard way in.
                      cell: (invoice) => (
                        <button
                          type="button"
                          className="hover:underline focus-visible:underline focus-visible:outline-none"
                          onClick={(event) => {
                            event.stopPropagation()
                            onOpen(invoice)
                          }}
                        >
                          {invoice.number}
                        </button>
                      ),
                    },
                    {
                      key: 'issued',
                      header: 'Issued',
                      cell: (invoice) =>
                        invoice.issuedAt ? formatDate(invoice.issuedAt, locale) : '—',
                    },
                    {
                      key: 'period',
                      header: 'Period',
                      className: 'text-muted-foreground max-md:hidden',
                      cell: (invoice) =>
                        formatRange(invoice.periodStart, invoice.periodEnd, locale),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (invoice) => <InvoiceStatusPill status={invoice.status} />,
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      className: 'text-right',
                      cell: (invoice) => (
                        <Money value={invoice.total} {...(locale ? { locale } : {})} />
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      className: 'w-12',
                      cell: (invoice) => (
                        // The row opens the invoice; the menu must not.
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          role="presentation"
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${invoice.number}`}
                                />
                              }
                            >
                              <MoreHorizontalIcon aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onOpen(invoice)}>
                                View invoice
                              </DropdownMenuItem>
                              {isPayable(invoice) ? (
                                <DropdownMenuItem onClick={() => onPay(invoice)}>
                                  Pay invoice
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => onDownload(invoice)}>
                                <DownloadIcon aria-hidden="true" />
                                Download PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ),
                    },
                  ]}
                />
              )}
              <p className="text-muted-foreground border-t px-6 py-3 text-xs">
                {shown.length} {shown.length === 1 ? 'invoice' : 'invoices'}, newest first
              </p>
            </>
          )
        }}
      </Loaded>
    </section>
  )
}
