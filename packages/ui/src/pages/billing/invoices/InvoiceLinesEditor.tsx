import { useId } from 'react'
import { XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { provenance } from '@ui/provenance'

/**
 * The lines of a draft invoice, editable in place.
 *
 * Backed by `POST /invoices/{id}/modify/execute`, which is a different route
 * from the one that saves a due date: and the only one that can change what
 * an invoice actually charges for.
 *
 * ## Finalized invoices
 *
 * The API also modifies a finalized invoice, but doing so **voids it and
 * recreates it as a draft copy under a new id**. That is a reasonable thing
 * for a person to choose and a terrible thing to discover, so the page that
 * holds this editor says so up front and confirms before saving.
 *
 * A manual edit also marks the invoice as manually edited, which disables
 * recompute: the caller surfaces that before the first change, not after.
 */
export const InvoiceLinesEditorProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input'],
  note: 'Draft invoice lines, edited in place; totals are the API’s, recalculated from what is left.',
})

/** A line as the editor holds it. A row with no `id` has not been saved yet. */
export interface EditableLine {
  /** Present for a line the invoice already has; absent for a new row. */
  id?: string
  displayName: string
  amount: string
  quantity: string
  /** The line's note, printed under it on the PDF. */
  description?: string
  /** The service period, as calendar days (`YYYY-MM-DD`); blank for none. */
  periodStart?: string
  periodEnd?: string
}

export interface InvoiceLinesEditorProps {
  lines: EditableLine[]
  onChange: (lines: EditableLine[]) => void
  disabled?: boolean
  /** Shown instead of the editor when the invoice is not a draft. */
  readOnlyReason?: string | null
}

const BLANK: EditableLine = { displayName: '', amount: '', quantity: '1' }

export function InvoiceLinesEditor({
  lines,
  onChange,
  disabled = false,
  readOnlyReason = null,
}: InvoiceLinesEditorProps) {
  const headingId = useId()

  if (readOnlyReason) {
    return (
      <section aria-labelledby={headingId} className="flex flex-col gap-2">
        <h2 id={headingId} className="text-sm font-medium">
          Lines
        </h2>
        <p className="text-muted-foreground text-sm">{readOnlyReason}</p>
      </section>
    )
  }

  const update = (index: number, patch: Partial<EditableLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-sm font-medium">
          Lines
        </h2>
        <p className="text-muted-foreground text-xs">
          The total is recalculated by Flexprice from the lines that remain.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This invoice has no lines. Add one below, or it will bill nothing.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <li key={line.id ?? `new-${index}`} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem_6rem_auto] items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Name</span>
                <Input
                  value={line.displayName}
                  disabled={disabled}
                  placeholder="What this line charges for"
                  onChange={(event) => update(index, { displayName: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Amount</span>
                <Input
                  value={line.amount}
                  inputMode="decimal"
                  disabled={disabled}
                  placeholder="0.00"
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Qty</span>
                <Input
                  value={line.quantity}
                  inputMode="decimal"
                  disabled={disabled}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Remove ${line.displayName || `line ${index + 1}`}`}
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Note</span>
                <Input
                  value={line.description ?? ''}
                  disabled={disabled}
                  placeholder="Optional, printed under the line"
                  onChange={(event) => update(index, { description: event.target.value })}
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Period from</span>
                <DateInput
                  value={line.periodStart ?? ''}
                  onValueChange={(periodStart) => update(index, { periodStart })}
                  placeholder="No period"
                  disabled={disabled}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Period to</span>
                <DateInput
                  value={line.periodEnd ?? ''}
                  onValueChange={(periodEnd) => update(index, { periodEnd })}
                  placeholder="No period"
                  disabled={disabled}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => onChange([...lines, { ...BLANK }])}
      >
        Add line
      </Button>
    </section>
  )
}
