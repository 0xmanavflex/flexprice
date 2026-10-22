import { CreditNoteStatus, formatMoney } from '@fp/domain'
import { CheckCircle2Icon, FileMinusIcon, MoreHorizontalIcon, XCircleIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { provenance } from '@ui/provenance'
import { DetailShell } from '../../../compositions/detail/DetailShell'
import { ActivitySection } from '../../../compositions/detail/ActivityLog'
import { MetadataCard } from '../../../compositions/detail/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../../compositions/detail/RelatedCard'
import { TotalRow, TotalsList } from '../../../compositions/detail/DetailKit'
import { Pill } from '../../shared/cells'
import { creditNoteChips, settlementNote, type CreditNoteDocument } from './creditNoteDocument'

/**
 * One credit memo, as a document rather than a list of fields.
 *
 * The page it replaced was two locked key/value cards, which could say what
 * was credited but never *against what* — the one comparison a credit memo
 * exists to let someone make. Here each line is a pair, invoiced beside
 * credited, and the footer answers the question the reader actually arrived
 * with: so what happened to the money.
 *
 * Built like the invoice page because it is the invoice's counterpart, and
 * someone who has read one should not have to learn a second layout to read
 * the document that undoes it.
 */
export const CreditNoteDetailViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/DetailShell',
    'compositions/MetadataCard',
    'compositions/RelatedCard',
    'compositions/ActivityLog',
    'compositions/detail-kit',
  ],
  note: 'Credit memo detail: DetailShell header with status chips, the memo document with invoiced-vs-credited lines and a settlement footer, and an Activity, Metadata, Related rail.',
})

export interface CreditNoteDetailViewProps {
  document: CreditNoteDocument
  onBack?: () => void
  onOpenInvoice?: (invoiceId: string) => void
  onOpenCustomer?: (customerId: string) => void
  /** Offered on a draft only. */
  onFinalize?: () => void
  /** Offered until it is already void. */
  onVoid?: () => void
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<void>
  locale?: string
}

export function CreditNoteDetailView({
  document,
  onBack,
  onOpenInvoice,
  onOpenCustomer,
  onFinalize,
  onVoid,
  onSaveMetadata,
  locale,
}: CreditNoteDetailViewProps) {
  const money = (value: string) =>
    formatMoney({ amount: value, currency: document.currency }, locale)

  const isDraft = document.status === CreditNoteStatus.Draft
  const isVoid = document.status === CreditNoteStatus.Voided

  const related: RelatedItem[] = [
    {
      id: 'invoice',
      label: 'Invoice',
      value: document.invoiceNumber || '—',
      ...(onOpenInvoice && document.invoiceId
        ? { onOpen: () => onOpenInvoice(document.invoiceId) }
        : {}),
    },
    {
      id: 'customer',
      label: 'Customer',
      value: document.creditTo.name,
      ...(onOpenCustomer && document.customerId
        ? { onOpen: () => onOpenCustomer(document.customerId) }
        : {}),
    },
  ]

  return (
    <DetailShell
      trail={[
        { label: 'Credit memos', ...(onBack ? { onClick: onBack } : {}) },
        { label: 'Credit memo' },
      ]}
      icon={<FileMinusIcon />}
      title={`Credit memo ${document.number}`}
      id={document.id}
      badges={creditNoteChips(document).map((chip) => (
        <Pill key={chip.label} tone={chip.tone}>
          {chip.label}
        </Pill>
      ))}
      actions={
        (isDraft && onFinalize) || (!isVoid && onVoid) ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Credit memo actions"
                />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                {isDraft && onFinalize ? (
                  <DropdownMenuItem onClick={onFinalize}>
                    <CheckCircle2Icon aria-hidden />
                    Finalize
                  </DropdownMenuItem>
                ) : null}
                {!isVoid && onVoid ? (
                  <DropdownMenuItem variant="destructive" onClick={onVoid}>
                    <XCircleIcon aria-hidden />
                    Void credit memo
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article
          aria-label="Credit memo document"
          className="bg-background w-full min-w-0 overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-6 px-8 pt-8">
            <div className="space-y-2">
              <p
                className={`text-3xl font-medium tracking-tight tabular-nums ${isVoid ? 'text-muted-foreground line-through' : ''}`}
              >
                {money(document.amount)}
              </p>
              <p className="text-muted-foreground text-[13px]">Amount credited</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">Memo number</dt>
              <dd className="tabular-nums">{document.number}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="tabular-nums">
                {document.issuedAt ?? (isDraft ? 'On finalize' : '—')}
              </dd>
              <dt className="text-muted-foreground">Against invoice</dt>
              <dd className="tabular-nums">
                {onOpenInvoice && document.invoiceId ? (
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => onOpenInvoice(document.invoiceId)}
                  >
                    {document.invoiceNumber || '—'}
                  </button>
                ) : (
                  document.invoiceNumber || '—'
                )}
              </dd>
            </dl>
          </div>

          <div className="grid gap-6 px-8 py-8 sm:grid-cols-3">
            <div className="space-y-1.5 text-[13px]">
              <p className="text-muted-foreground text-[11px] tracking-wider uppercase">
                Credit to
              </p>
              {onOpenCustomer && document.customerId ? (
                <button
                  type="button"
                  className="font-medium hover:underline"
                  onClick={() => onOpenCustomer(document.customerId)}
                >
                  {document.creditTo.name}
                </button>
              ) : (
                <p className="font-medium">{document.creditTo.name}</p>
              )}
              {document.creditTo.email ? (
                <p className="text-muted-foreground">{document.creditTo.email}</p>
              ) : null}
              {document.creditTo.address.map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
            <div className="space-y-1.5 text-[13px]">
              <p className="text-muted-foreground text-[11px] tracking-wider uppercase">Reason</p>
              <p>{document.reason || '—'}</p>
            </div>
            <div className="space-y-1.5 text-[13px]">
              <p className="text-muted-foreground text-[11px] tracking-wider uppercase">Memo</p>
              {document.memo ? (
                <p className="text-muted-foreground whitespace-pre-line">{document.memo}</p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </div>
          </div>

          <div
            role="region"
            aria-label="Credited line comparison"
            tabIndex={0}
            className="mx-8 overflow-x-auto border-t pt-3"
          >
            <div role="table" aria-label="Credited lines" className="min-w-[360px] text-sm">
              <div
                role="row"
                className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-4 border-b pb-3 text-xs"
              >
                <span role="columnheader">Description</span>
                <span role="columnheader" className="text-right">
                  Invoiced
                </span>
                <span role="columnheader" className="text-right">
                  Credited
                </span>
              </div>
              {document.lines.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-[13px]">
                  This memo credits no lines.
                </p>
              ) : (
                document.lines.map((line) => (
                  <div
                    key={line.id}
                    role="row"
                    className="border-border/50 grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-start gap-4 border-b py-4 last:border-b-0"
                  >
                    <span role="cell" className="min-w-0">
                      {line.description}
                    </span>
                    <span role="cell" className="text-muted-foreground text-right tabular-nums">
                      {line.invoiced === null ? '—' : money(line.invoiced)}
                    </span>
                    <span role="cell" className="text-right tabular-nums">
                      {money(line.credited)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mx-8 flex justify-end border-t py-6">
            <TotalsList>
              {document.invoiceTotal !== undefined ? (
                <TotalRow label="Invoice total" value={money(document.invoiceTotal)} />
              ) : null}
              <TotalRow
                label="Total credited"
                value={money(document.amount)}
                emphasis="due"
                rule
              />
              {document.invoiceAmountDue !== undefined ? (
                <TotalRow
                  label="Current invoice amount due"
                  value={money(document.invoiceAmountDue)}
                />
              ) : null}
            </TotalsList>
          </div>

          {/*
            The last question a credit memo raises, answered in a sentence
            rather than left to a `refund_status` chip the reader translates.
          */}
          <p className="bg-muted/40 text-muted-foreground border-t px-8 py-4 text-[13px]">
            {settlementNote(document, money(document.amount))}
          </p>
        </article>

        <aside aria-label="Credit memo details" className="flex flex-col gap-5 xl:sticky xl:top-6">
          <ActivitySection
            entries={document.events.map((event) => ({
              id: event.id,
              title: event.title,
              at: event.at,
              summary: event.summary,
            }))}
            emptyText="No dates recorded yet."
          />
          {document.metadata !== undefined ? (
            <MetadataCard
              metadata={document.metadata}
              {...(onSaveMetadata ? { onSave: onSaveMetadata } : {})}
            />
          ) : null}
          <RelatedCard items={related} />
        </aside>
      </div>
    </DetailShell>
  )
}
