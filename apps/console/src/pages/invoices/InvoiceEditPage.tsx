import { useState } from 'react'
import { ApiError, useInvoice, useUpdateInvoice } from '@fp/query'
import { InvoiceStatus } from '@fp/domain'
import { AppFailure, Field, LoadingRows, PageBody, Section } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'

export interface InvoiceEditPageProps {
  invoiceId: string
  onCancel: () => void
  onDone: () => void
}

/**
 * Editing an invoice, scoped to what the API will actually change.
 *
 * This replaces a page that could not work. `/invoices/:id/edit` used to render
 * the *create* form — customer, currency, line items — and answer every save
 * with "not available yet", because `PUT /invoices/{id}` accepts none of those
 * fields. Its whole body is `invoice_pdf_url`, `due_date`, `metadata` and
 * `apply_discount`.
 *
 * That is not a gap to fill later. An issued invoice is a financial record: its
 * customer, amounts and lines are fixed once it exists, and correcting one of
 * them means voiding and reissuing, or a credit note. A form that offers to
 * edit them is lying about what the product does.
 *
 * So what is left here is the due date, and recalculating a draft's discount.
 * Metadata and payment status are deliberately *not* repeated — both are
 * already edited in place on the detail page, and a second control for the
 * same field is the bug this page exists to remove.
 */
export function InvoiceEditPage({ invoiceId, onCancel, onDone }: InvoiceEditPageProps) {
  const invoice = useInvoice(invoiceId)
  const save = useUpdateInvoice()
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [applyDiscount, setApplyDiscount] = useState(false)

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

  const existing = invoice.data
  const isDraft = existing.status === InvoiceStatus.Draft
  // `null` means untouched, so the field shows what the invoice already has.
  const value = dueDate ?? toDateInput(existing.dueDate)

  /*
   * The API refuses a due date in the past, so the picker refuses one too.
   * Today is allowed: the check is against "now", and a date chosen today is
   * midnight UTC, which may already have passed — that one the API decides.
   */
  const changed = value !== toDateInput(existing.dueDate) || applyDiscount

  return (
    <PageBody>
      <Section
        title="Edit invoice"
        description={`${existing.number} — only the due date can be changed after an invoice is created.`}
      >
        <form
          className="flex max-w-md flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              {
                id: existing.id,
                ...(value !== toDateInput(existing.dueDate)
                  ? { dueDate: value ? new Date(`${value}T00:00:00Z`) : null }
                  : {}),
                ...(applyDiscount ? { applyDiscount: true } : {}),
              },
              { onSuccess: onDone },
            )
          }}
        >
          <Field
            label="Due date"
            hint="When payment is expected. The API refuses a date in the past."
          >
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={value}
                disabled={save.isPending}
                onChange={(event) => setDueDate(event.target.value)}
              />
            )}
          </Field>

          {isDraft ? (
            <label className="text-muted-foreground flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyDiscount}
                disabled={save.isPending}
                onChange={(event) => setApplyDiscount(event.target.checked)}
                className="accent-primary mt-0.5 size-4"
              />
              <span>
                Recalculate the discount from this invoice&apos;s coupons. Drafts only — a finalized
                invoice keeps the discount it was issued with.
              </span>
            </label>
          ) : null}

          {save.error ? (
            <p
              role="alert"
              className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {messageForSave(save.error)}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending || !changed}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </Section>
    </PageBody>
  )
}

/** A `Date` as the `<input type="date">` value, or empty when there is none. */
function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

/**
 * The API's own words where it has useful ones.
 *
 * "due_date cannot be in the past" is a real, actionable complaint about the
 * thing the person just typed, so it is shown rather than replaced — unlike the
 * sign-in messages, which describe a backend call stack.
 */
function messageForSave(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return 'The invoice could not be saved. Try again.'
}
