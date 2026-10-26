import {
  PaymentStatus,
  manualPaymentStatusBlocked,
  manualPaymentStatusChoices,
  moneyOr,
} from '@fp/domain'
import {
  type InvoiceEditSave,
  type LineItemEdit,
  serverReason,
  useCustomer,
  useInvoice,
  useInvoicePayments,
  useSaveInvoiceEdit,
  useTenant,
  useUserInfo,
} from '@fp/query'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import {
  InvoiceForm,
  type EditableInvoice,
  type EditableLine,
  type InvoiceEditDraft,
  linesChanged,
} from '@fp/ui/pages'
import { customerParty, tenantParty } from './invoiceParties'

export interface InvoiceEditPageProps {
  invoiceId: string
  onCancel: () => void
  /** Saved; opens the invoice the edit ended on, a new draft copy when one was made. */
  onDone: (invoiceId: string) => void
}

/** A `Date` as a calendar day (`YYYY-MM-DD`), or blank. */
const toDay = (date: Date | null | undefined): string =>
  date ? date.toISOString().slice(0, 10) : ''

/**
 * Editing an invoice, completely, as V1 does: `InvoiceEditView` holds the
 * form; this reads the invoice, works out what changed, and saves it with
 * {@link useSaveInvoiceEdit} in the order the API needs.
 */
export function InvoiceEditPage({ invoiceId, onCancel, onDone }: InvoiceEditPageProps) {
  const invoice = useInvoice(invoiceId)
  const payments = useInvoicePayments(invoiceId)
  const save = useSaveInvoiceEdit()
  const customer = useCustomer(invoice.data?.customerId ?? '')
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId || invoice.data?.tenantId || '')

  if (invoice.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  if (invoice.error || !invoice.data) {
    return (
      <PageBody>
        <AppFailure
          title={invoice.error ? 'This invoice could not be loaded' : 'Invoice not found'}
          detail="The rest of the console still works. Try again, or go back."
          onRetry={invoice.error ? () => void invoice.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const data = invoice.data
  if (data.status === 'void' || data.status === 'skipped') {
    return (
      <PageBody>
        <AppFailure
          title="This invoice can no longer be edited"
          detail="Only draft and finalized invoices change. Raise a new invoice or a credit memo instead."
          onRetry={onCancel}
        />
      </PageBody>
    )
  }

  const lines: EditableLine[] = data.lines.map((line) => ({
    id: line.id,
    displayName: line.description,
    amount: line.amount,
    quantity: line.quantity,
    description: line.note ?? '',
    periodStart: toDay(line.periodStart),
    periodEnd: toDay(line.periodEnd),
  }))
  const editable: EditableInvoice = {
    number: data.number,
    customerName: data.customerName,
    status: data.status,
    paymentStatus: data.paymentStatus,
    currency: data.currency,
    issueDate: toDay(data.issuedAt),
    description: data.description,
    tax: moneyOr(data.tax, data.currency),
    total: data.total,
    amountDue: data.amountDue,
    amountPaid: moneyOr(data.amountPaid, data.currency),
    amountRemaining: data.amountRemaining,
    dueDate: toDay(data.dueDate),
    metadata: data.metadata,
    lines,
  }

  const toSave = (draft: InvoiceEditDraft): InvoiceEditSave => {
    const metadataChanged = JSON.stringify(draft.metadata) !== JSON.stringify({ ...data.metadata })
    return {
      invoiceId: data.id,
      ...(draft.dueDate !== editable.dueDate
        ? { dueDate: draft.dueDate ? new Date(`${draft.dueDate}T00:00:00Z`) : null }
        : {}),
      ...(metadataChanged ? { metadata: draft.metadata } : {}),
      ...(draft.applyDiscount ? { applyDiscount: true } : {}),
      ...(draft.paymentStatus
        ? {
            paymentStatus: {
              status: draft.paymentStatus,
              ...(draft.paymentStatus === PaymentStatus.Pending && draft.paymentAmount
                ? { amount: draft.paymentAmount }
                : {}),
            },
          }
        : {}),
      ...(linesChanged(lines, draft.lines) ? { lines: diffLines(lines, draft.lines) } : {}),
      ...(draft.nextStatus !== 'keep' ? { nextStatus: draft.nextStatus } : {}),
    }
  }

  return (
    <InvoiceForm
      mode="edit"
      trail={[
        { label: 'Invoices' },
        { label: data.number || 'Invoice', onClick: onCancel },
        { label: 'Edit' },
      ]}
      invoice={editable}
      billFrom={tenantParty(tenant.data)}
      billTo={customerParty(customer.data)}
      paymentChoices={manualPaymentStatusChoices(data.paymentStatus)}
      paymentStatusBlocked={manualPaymentStatusBlocked({
        status: data.status,
        paymentStatus: data.paymentStatus,
        succeededPayments: (payments.data ?? []).filter(
          (payment) => payment.status === PaymentStatus.Succeeded,
        ).length,
      })}
      isSubmitting={save.isPending}
      submitError={
        save.error
          ? (serverReason(save.error) ?? 'The invoice could not be saved. Try again.')
          : null
      }
      onCancel={onCancel}
      onSave={(draft) => save.mutate(toSave(draft), { onSuccess: (id) => onDone(id) })}
    />
  )
}

/** A line as the modify endpoint takes it: trimmed, quantity defaulted, blanks left out. */
function toEdit(line: EditableLine): LineItemEdit {
  return {
    displayName: line.displayName.trim(),
    amount: line.amount.trim(),
    quantity: line.quantity.trim() || '1',
    description: (line.description ?? '').trim(),
    ...(line.periodStart ? { periodStart: line.periodStart } : {}),
    ...(line.periodEnd ? { periodEnd: line.periodEnd } : {}),
  }
}

/**
 * What changed, in the shape the modify endpoint takes: a row the invoice has
 * and the editor dropped is a remove, a row without an id an add, and a row
 * whose fields moved an update. Untouched rows are left out: an update that
 * changes nothing still versions the line and changes its id.
 */
export function diffLines(original: EditableLine[], current: EditableLine[]) {
  const kept = new Set(current.map((line) => line.id).filter(Boolean))
  const removed = original
    .map((line) => line.id)
    .filter((id): id is string => Boolean(id) && !kept.has(id))
  const before = new Map(original.filter((line) => line.id).map((line) => [line.id, line]))
  const updated: LineItemEdit[] = []
  const added: LineItemEdit[] = []
  for (const line of current) {
    if (!line.id) {
      if (line.displayName.trim() || line.amount.trim()) added.push(toEdit(line))
      continue
    }
    const was = before.get(line.id)
    if (was && JSON.stringify(toEdit(was)) !== JSON.stringify(toEdit(line))) {
      updated.push({ ...toEdit(line), id: line.id })
    }
  }
  return { removed, updated, added }
}
