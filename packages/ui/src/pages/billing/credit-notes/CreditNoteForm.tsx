import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect } from 'react'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CREDIT_NOTE_REASON_LABEL,
  CREDIT_NOTE_REFUND_TARGET_LABEL,
  type CreateCreditNote,
  createCreditNoteSchema,
  emptyCreditNote,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionSelect, type Option } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const CreditNoteFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/textarea',
    'ui/switch',
    'compositions/form-card',
    'compositions/form-page',
  ],
  note: 'RHF + createCreditNoteSchema; the lines come from the chosen invoice.',
})

const REASONS = Object.entries(CREDIT_NOTE_REASON_LABEL).map(([value, label]) => ({ value, label }))
/**
 * "Let Flexprice decide" is the schema's `''` (no target sent). `OptionSelect`
 * reads `''` as nothing chosen and shows its placeholder, so the field carries
 * its own value for it and maps back at the field's edge.
 */
const FLEXPRICE_DECIDES = 'FLEXPRICE_DECIDES'
const REFUND_TARGETS = [
  { value: FLEXPRICE_DECIDES, label: 'Let Flexprice decide' },
  ...Object.entries(CREDIT_NOTE_REFUND_TARGET_LABEL).map(([value, label]) => ({ value, label })),
]

export interface CreditNoteInvoiceLine {
  id: string
  description: string
  /** What the line billed, as the API sent it. Shown, never summed. */
  amount: string
}

export interface CreditNoteFormProps {
  invoices: readonly Option[]
  /** The chosen invoice's lines; empty until one is picked and loaded. */
  invoiceLines: readonly CreditNoteInvoiceLine[]
  linesLoading?: boolean
  onInvoiceChange: (invoiceId: string) => void
  /** The invoice chosen when the form opens. */
  defaultInvoiceId?: string
  trail: DetailCrumb[]
  onSubmit: (creditNote: CreateCreditNote) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

/** Credit part of an invoice: pick it, then say how much of each line to give back. */
export function CreditNoteForm({
  invoices,
  invoiceLines,
  linesLoading = false,
  onInvoiceChange,
  trail,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  defaultInvoiceId,
}: CreditNoteFormProps) {
  const form = useCalmForm<CreateCreditNote>({
    resolver: standardSchemaResolver(createCreditNoteSchema) as Resolver<CreateCreditNote>,
    defaultValues: defaultInvoiceId
      ? { ...emptyCreditNote(), invoiceId: defaultInvoiceId }
      : emptyCreditNote(),
  })
  const errors = form.formState.errors
  const lines = form.watch('lines')

  useEffect(() => {
    form.setValue(
      'lines',
      invoiceLines.map((line) => ({
        invoiceLineItemId: line.id,
        label: line.description,
        amount: '',
      })),
    )
    // The lines belong to the invoice, so a new invoice replaces them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceLines])

  return (
    <FormPage
      title="New credit memo"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'create',
        noun: 'credit memo',
        formId: 'credit-note-create-form',
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form
        id="credit-note-create-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
      >
        <FormCard title="Credit memo details" status="required">
          <FormRow
            label="Invoice"
            hint="The invoice this credit memo reduces."
            required
            error={errors.invoiceId?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="invoiceId"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={(value) => {
                      control.onChange(value)
                      onInvoiceChange(value)
                    }}
                    options={invoices}
                    placeholder="Choose an invoice"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Reason"
            hint="Why the credit is being issued."
            required
            error={errors.reason?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="reason"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={control.onChange}
                    options={REASONS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Lines to credit"
            required
            align="start"
            hint="Leave a line blank to credit nothing for it."
            error={errors.lines?.message ?? errors.lines?.root?.message}
          >
            <div className="flex flex-col gap-2">
              {lines.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {linesLoading ? 'Loading lines…' : 'Choose an invoice to see its lines.'}
                </p>
              ) : (
                lines.map((line, index) => {
                  const source = invoiceLines[index]
                  return (
                    <div
                      key={line.invoiceLineItemId}
                      className="grid grid-cols-[minmax(0,1fr)_6rem_7rem] items-center gap-2"
                    >
                      <span className="truncate text-sm">{line.label}</span>
                      <span className="text-muted-foreground text-end text-xs tabular-nums">
                        {source?.amount ?? ''}
                      </span>
                      <div className="flex flex-col gap-1">
                        <Input
                          aria-label={`Credit for ${line.label}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={isSubmitting}
                          {...form.register(`lines.${index}.amount`)}
                        />
                        {errors.lines?.[index]?.amount?.message ? (
                          <span className="text-destructive text-xs">
                            {errors.lines[index]?.amount?.message}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </FormRow>
          <FormRow label="Refund to" hint="Only matters when the invoice was paid.">
            {({ id }) => (
              <Controller
                control={form.control}
                name="refundTarget"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    value={control.value || FLEXPRICE_DECIDES}
                    onValueChange={(next) =>
                      control.onChange(next === FLEXPRICE_DECIDES ? '' : next)
                    }
                    options={REFUND_TARGETS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Memo"
            hint="A note shown to the customer on the credit memo."
            align="start"
            error={errors.memo?.message}
          >
            {({ id, ...field }) => (
              <Textarea
                id={id}
                rows={2}
                disabled={isSubmitting}
                {...field}
                {...form.register('memo')}
              />
            )}
          </FormRow>
          <FormRow label="Process now" hint="Applies it straight away. Off keeps a draft.">
            {({ id }) => (
              <Controller
                control={form.control}
                name="processNow"
                render={({ field: control }) => (
                  <Switch
                    id={id}
                    checked={control.value}
                    onCheckedChange={control.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}
