import { useState } from 'react'
import {
  ApiError,
  useInvoice,
  useModifyInvoiceLineItems,
  useUpdateInvoice,
  type LineItemEdit,
} from '@fp/query'
import { InvoiceStatus } from '@fp/domain'
import { AppFailure, Field, LoadingRows, PageBody, Section } from '@fp/ui/compositions'
import { InvoiceLinesEditor, type EditableLine } from '@fp/ui/pages'
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
  const saveLines = useModifyInvoiceLineItems()
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [applyDiscount, setApplyDiscount] = useState(false)
  /** `null` until the editor is first touched, so the invoice's own lines show. */
  const [lines, setLines] = useState<EditableLine[] | null>(null)

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
  const original: EditableLine[] = existing.lines.map((line) => ({
    id: line.id,
    displayName: line.description,
    amount: line.amount,
    quantity: line.quantity,
  }))
  const current = lines ?? original
  const lineChanges = diffLines(original, current)
  const linesChanged =
    lineChanges.removed.length > 0 || lineChanges.updated.length > 0 || lineChanges.added.length > 0
  // `null` means untouched, so the field shows what the invoice already has.
  const value = dueDate ?? toDateInput(existing.dueDate)

  /*
   * The API refuses a due date in the past, so the picker refuses one too.
   * Today is allowed: the check is against "now", and a date chosen today is
   * midnight UTC, which may already have passed — that one the API decides.
   */
  const changed = value !== toDateInput(existing.dueDate) || applyDiscount || linesChanged

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
            /*
             * Lines first, then the due date.
             *
             * A line edit can hand back a different invoice id — modifying a
             * finalized invoice replaces it — so the id the due date is saved
             * against has to be the one the line edits ended on, not the one
             * the page opened with.
             */
            const saveScalars = (id: string) => {
              const patch = {
                id,
                ...(value !== toDateInput(existing.dueDate)
                  ? { dueDate: value ? new Date(`${value}T00:00:00Z`) : null }
                  : {}),
                ...(applyDiscount ? { applyDiscount: true } : {}),
              }
              // Nothing but the id means nothing to say.
              if (Object.keys(patch).length === 1) return onDone()
              save.mutate(patch, { onSuccess: onDone })
            }

            if (linesChanged) {
              saveLines.mutate(
                { invoiceId: existing.id, ...lineChanges },
                { onSuccess: (result) => saveScalars(result.invoiceId) },
              )
              return
            }
            saveScalars(existing.id)
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

          <InvoiceLinesEditor
            lines={current}
            onChange={setLines}
            disabled={save.isPending || saveLines.isPending}
            readOnlyReason={
              isDraft
                ? null
                : 'Lines can only be edited while an invoice is a draft. Editing a finalized invoice voids it and replaces it with a draft copy, so Flexprice asks you to do that deliberately — void it and reissue, or raise a credit note.'
            }
          />

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

          {save.error || saveLines.error ? (
            <p
              role="alert"
              className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {messageForSave(save.error ?? saveLines.error)}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending || saveLines.isPending || !changed}>
              {save.isPending || saveLines.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={save.isPending || saveLines.isPending}
            >
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

/**
 * What changed, in the shape the modify endpoint takes.
 *
 * A row the editor still holds but the invoice does not is an add; one the
 * invoice has and the editor dropped is a remove; one whose fields moved is an
 * update. A row whose fields are untouched is left out entirely — every call
 * costs a round trip, and an update that changes nothing still versions the
 * line item and changes its id.
 */
/** The comparable form of a line: trimmed, with a blank quantity read as one. */
function normalise(line: EditableLine): { displayName: string; amount: string; quantity: string } {
  return {
    displayName: line.displayName.trim(),
    amount: line.amount.trim(),
    quantity: line.quantity.trim() || '1',
  }
}

function diffLines(
  original: EditableLine[],
  current: EditableLine[],
): { removed: string[]; updated: LineItemEdit[]; added: LineItemEdit[] } {
  const keptIds = new Set(current.map((line) => line.id).filter(Boolean))
  const removed = original
    .map((line) => line.id)
    .filter((id): id is string => Boolean(id) && !keptIds.has(id))

  const before = new Map(original.filter((l) => l.id).map((l) => [l.id as string, l]))
  const updated: LineItemEdit[] = []
  const added: LineItemEdit[] = []

  for (const line of current) {
    const edit: LineItemEdit = {
      displayName: line.displayName.trim(),
      amount: line.amount.trim(),
      quantity: line.quantity.trim() || '1',
      ...(line.description !== undefined ? { description: line.description } : {}),
    }
    if (!line.id) {
      // A blank row the person added and never filled in is not a line.
      if (edit.displayName !== '' || edit.amount !== '') added.push(edit)
      continue
    }
    const was = before.get(line.id)
    if (!was) continue
    /*
     * Both sides are normalised before comparing.
     *
     * The edited side is trimmed and defaults a blank quantity to 1, so
     * comparing it against the raw original reported a change on every line
     * the API sent with an empty quantity — which lit up Save before anyone
     * had touched anything, and would have fired an update per line that
     * versioned them all for nothing.
     */
    const same =
      normalise(was).displayName === edit.displayName &&
      normalise(was).amount === edit.amount &&
      normalise(was).quantity === edit.quantity
    if (!same) updated.push({ ...edit, id: line.id })
  }

  return { removed, updated, added }
}
