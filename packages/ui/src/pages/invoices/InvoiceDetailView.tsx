import { useState } from 'react'
import { DetailBreadcrumb, DetailHeader, Section } from '../../compositions'
import { CopyId, DetailTabs, Properties, SimpleTable } from '../../compositions/DetailKit'
import { Button } from '@ui/components/primitives/button'
import { Switch } from '@ui/components/primitives/switch'
import { Badge } from '@ui/components/reui/badge'
import { AccountActivityRail } from '@ui/components/blocks/solution-billing-4/components/account-activity-rail'
import { displayStatus, invoiceTotals, type InvoiceDocument } from './invoiceDocument'

export interface InvoiceDetailViewProps {
  invoice: InvoiceDocument
  onBack?: () => void
  onFinalize?: () => void
  onRetryPayment?: () => void
  onDownload?: () => void
  onOpenCustomer?: () => void
}

const TONE: Record<string, string> = {
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
}

export function InvoiceDetailView({
  invoice,
  onBack,
  onFinalize,
  onRetryPayment,
  onDownload,
  onOpenCustomer,
}: InvoiceDetailViewProps) {
  const [showZero, setShowZero] = useState(false)
  const status = displayStatus(invoice)
  const totals = invoiceTotals(invoice)
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(value)
  const isDraft = invoice.status === 'draft'
  const lines = showZero ? invoice.lines : invoice.lines.filter((line) => line.amount !== 0)

  const document = (
    <Section title={isDraft ? 'Draft invoice' : `Invoice ${invoice.number ?? ''}`} description={`Issued to ${invoice.billTo.name}`}>
      <div className="flex flex-col gap-6">
        <Properties
          columns={4}
          items={[
            { label: 'Number', value: invoice.number ?? 'On finalize' },
            { label: 'Issued', value: invoice.issuedAt ?? 'On finalize' },
            { label: 'Due', value: invoice.dueAt ?? '—' },
            { label: 'Amount due', value: money(totals.due) },
          ]}
        />
        <div className="grid gap-6 border-t pt-6 sm:grid-cols-3">
          <Party heading="Bill to" lines={[invoice.billTo.name, invoice.billTo.email, invoice.billTo.address]} />
          <Party heading="From" lines={[invoice.from.name, invoice.from.address]} />
          <Party heading="Payment" lines={[invoice.payment.method, invoice.payment.terms]} />
        </div>
        <div className="flex flex-col gap-2 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Items</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Show zero amounts
              <Switch checked={showZero} onCheckedChange={setShowZero} aria-label="Show zero amounts" />
            </label>
          </div>
          <SimpleTable
            rows={lines}
            getRowId={(line) => line.id}
            columns={[
              {
                key: 'd',
                header: 'Description',
                cell: (line) => (
                  <div className="flex flex-col">
                    <span>{line.description}</span>
                    {line.detail ? <span className="text-xs text-muted-foreground">{line.detail}</span> : null}
                  </div>
                ),
              },
              { key: 'q', header: 'Quantity', cell: (line) => line.quantity },
              { key: 'a', header: 'Amount', cell: (line) => money(line.amount) },
            ]}
          />
        </div>
        <dl className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm tabular-nums">
          <Total label="Subtotal" value={money(totals.subtotal)} />
          {invoice.prepaidCredits ? <Total label="Prepaid credits" value={`-${money(invoice.prepaidCredits)}`} /> : null}
          <Total label="Tax" value={money(invoice.tax)} />
          <Total label="Paid" value={money(invoice.paid)} />
          <Total label="Amount due" value={money(totals.due)} strong />
        </dl>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <span>
            {isDraft
              ? 'Finalizing locks the lines and sends the invoice to the customer.'
              : status?.label === 'Payment failed'
                ? 'The last payment attempt failed. Retry collection or update the payment method.'
                : 'Payment is collected automatically on the due date.'}
          </span>
          {status?.label === 'Payment failed' ? (
            <Button variant="outline" onClick={onRetryPayment}>
              Retry payment
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <DetailHeader
        breadcrumb={
          <DetailBreadcrumb
            trail={[
              { label: 'Invoices', ...(onBack ? { onClick: onBack } : {}) },
              { label: invoice.number ?? 'Draft invoice' },
            ]}
          />
        }
        title={isDraft ? 'Draft invoice' : (invoice.number ?? invoice.id)}
        badges={status ? <Badge variant={TONE[status.tone] as never}>{status.label}</Badge> : null}
        description={`${invoice.billTo.name} · ${money(totals.due)} due`}
        actions={
          <>
            <Button variant="outline" onClick={onDownload}>
              Download
            </Button>
            {isDraft ? <Button onClick={onFinalize}>Finalize invoice</Button> : null}
          </>
        }
      />
      <div className="flex items-center gap-2 px-6 pb-2">
        <CopyId value={invoice.id} />
      </div>
      <div className="px-6 pb-10">
        <DetailTabs
          tabs={[
            {
              value: 'overview',
              label: 'Overview',
              content: (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  {document}
                  <div className="flex flex-col gap-6">
                    <Section title="Timeline">
                      <AccountActivityRail events={invoice.events.map((e) => ({ ...e, labels: [] })) as never} />
                    </Section>
                    <Section title="Related">
                      <dl className="flex flex-col gap-3 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Customer</dt>
                          <dd>
                            <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={onOpenCustomer}>
                              {invoice.billTo.name}
                            </button>
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Subscription</dt>
                          <dd>{invoice.subscriptionLabel}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Credit notes</dt>
                          <dd>{invoice.creditNotes.length || 'None'}</dd>
                        </div>
                      </dl>
                    </Section>
                  </div>
                </div>
              ),
            },
            {
              value: 'payments',
              label: 'Payments',
              count: invoice.payments.length,
              content: (
                <Section title="Payments">
                  <SimpleTable
                    rows={invoice.payments}
                    getRowId={(p) => p.id}
                    empty="No payments yet."
                    columns={[
                      { key: 'd', header: 'Date', cell: (p) => p.date },
                      { key: 'm', header: 'Method', cell: (p) => p.method },
                      { key: 'a', header: 'Amount', cell: (p) => money(p.amount) },
                      { key: 's', header: 'Status', cell: (p) => p.status },
                    ]}
                  />
                </Section>
              ),
            },
            {
              value: 'credit-notes',
              label: 'Credit notes',
              count: invoice.creditNotes.length,
              content: (
                <Section title="Credit notes">
                  <SimpleTable
                    rows={invoice.creditNotes}
                    getRowId={(n) => n.id}
                    empty="No credit notes for this invoice."
                    columns={[
                      { key: 'n', header: 'Number', cell: (n) => n.number },
                      { key: 'd', header: 'Date', cell: (n) => n.date },
                      { key: 'a', header: 'Amount', cell: (n) => money(n.amount) },
                    ]}
                  />
                </Section>
              ),
            },
            {
              value: 'information',
              label: 'Information',
              content: (
                <Section title="Information">
                  <Properties
                    items={[
                      { label: 'Invoice ID', value: invoice.id },
                      { label: 'Currency', value: invoice.currency },
                      { label: 'Customer', value: invoice.billTo.name },
                      { label: 'Payment terms', value: invoice.payment.terms },
                    ]}
                  />
                </Section>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

function Party({ heading, lines }: { heading: string; lines: string[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h3 className="text-xs text-muted-foreground">{heading}</h3>
      {lines.map((line, index) => (
        <span key={line} className={index === 0 ? 'font-medium' : 'text-muted-foreground'}>
          {line}
        </span>
      ))}
    </div>
  )
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t pt-2 font-medium' : 'text-muted-foreground'}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
