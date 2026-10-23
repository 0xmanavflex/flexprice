import { type PortalInvoice, isPayable } from '@fp/domain'
import { DownloadIcon, EyeIcon, MoreHorizontalIcon, ReceiptIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { Money } from '../shared/Money'
import { formatDate } from './format'
import { InvoiceStatusPill, Loaded, PortalEmpty, invoiceStatusLabel } from './parts'
import type { CustomerPortalData } from './types'

/**
 * Every invoice, newest first, after the portal prototype
 * (`portal/invoices.tsx`): the kit's table with its own search, status filter
 * and pages; a row opens the invoice; its menu views, pays or downloads.
 */
export const PortalInvoicesProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'pages/shared/DetailTable',
    'primitives/dropdown-menu',
    'shared/Money',
  ],
  note: 'Customer portal invoices, after the portal prototype.',
})

export interface PortalInvoicesProps {
  data: CustomerPortalData
  locale: string | undefined
  onOpen: (invoice: PortalInvoice) => void
  onPay: (invoice: PortalInvoice) => void
  onDownload: (invoice: PortalInvoice) => void
}

export function PortalInvoices({ data, locale, onOpen, onPay, onDownload }: PortalInvoicesProps) {
  const count = data.invoices.status === 'ready' ? data.invoices.data.length : 0
  return (
    <Section
      title="Invoices"
      {...(count
        ? { description: `${count} ${count === 1 ? 'invoice' : 'invoices'}, newest first` }
        : {})}
      flush
    >
      <Loaded load={data.invoices} label="invoices" rows={6}>
        {(invoices) =>
          invoices.length === 0 ? (
            <PortalEmpty
              icon={<ReceiptIcon />}
              title="No invoices yet"
              description="Invoices appear here once your first billing period closes."
            />
          ) : (
            <DetailTable
              label="Invoices"
              noun="invoices"
              rows={invoices}
              columns={invoiceColumns({ locale, onOpen, onPay, onDownload })}
              onRowClick={onOpen}
              facet={{ label: 'Status', value: (invoice) => invoiceStatusLabel(invoice.status) }}
              searchText={(invoice) => `${invoice.number} ${invoiceStatusLabel(invoice.status)}`}
              compact
              pageSize={25}
            />
          )
        }
      </Loaded>
    </Section>
  )
}

function invoiceColumns({
  locale,
  onOpen,
  onPay,
  onDownload,
}: Omit<PortalInvoicesProps, 'data'>): DetailColumn<PortalInvoice>[] {
  return [
    {
      key: 'number',
      header: 'Invoice',
      text: (invoice) => invoice.number,
      sortBy: (invoice) => invoice.number,
      cell: (invoice) => <span className="font-medium">{invoice.number}</span>,
    },
    {
      key: 'issued',
      header: 'Issued',
      sortBy: (invoice) => invoice.issuedAt?.getTime() ?? 0,
      cell: (invoice) => (
        <span className="text-muted-foreground">
          {invoice.issuedAt ? formatDate(invoice.issuedAt, locale) : '—'}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      cell: (invoice) => (
        <span className="text-muted-foreground">
          {invoice.periodStart && invoice.periodEnd
            ? `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      text: (invoice) => invoiceStatusLabel(invoice.status),
      cell: (invoice) => <InvoiceStatusPill status={invoice.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortBy: (invoice) => Number(invoice.total.amount),
      cell: (invoice) => (
        <span className="tabular-nums">
          <Money value={invoice.total} {...(locale ? { locale } : {})} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 48,
      cell: (invoice) => (
        // The row opens the invoice; its menu must not.
        <div
          className="flex justify-end"
          role="presentation"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-8"
                  aria-label={`Actions for ${invoice.number}`}
                />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onOpen(invoice)}>
                <EyeIcon aria-hidden="true" />
                View invoice
              </DropdownMenuItem>
              {isPayable(invoice) ? (
                <DropdownMenuItem onClick={() => onPay(invoice)}>
                  <ReceiptIcon aria-hidden="true" />
                  Pay now
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onDownload(invoice)}>
                <DownloadIcon aria-hidden="true" />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]
}
