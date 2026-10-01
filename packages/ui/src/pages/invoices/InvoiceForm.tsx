import { Controller, useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { type CreateInvoice, createInvoiceSchema, emptyInvoice } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { DateInput } from '@ui/compositions/DateInput'
import { FormActions } from '@ui/compositions/FormActions'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { OptionSelect, type Option } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a one-off invoice: `FormPage` → `FormCard` rows, the same shell as the
 * other create forms.
 *
 * ReUI's `form-3` invoice creator is a self-contained demo with its own product
 * catalogue and no props, so it cannot be fed real customers or submit anywhere
 * without being edited; this form replaces it. The total is typed, not summed:
 * the money module has no arithmetic by design.
 */
export const InvoiceFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/textarea',
    'ui/switch',
    'compositions/form-card',
    'compositions/form-page',
    'compositions/form-actions',
  ],
  note: 'RHF + createInvoiceSchema, with a useFieldArray for lines.',
})

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'].map((code) => ({ value: code, label: code }))

export interface InvoiceFormProps {
  customers: readonly Option[]
  trail: DetailCrumb[]
  defaultValue?: CreateInvoice
  onSubmit: (invoice: CreateInvoice) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function InvoiceForm({
  customers,
  trail,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: InvoiceFormProps) {
  const form = useForm<CreateInvoice>({
    resolver: standardSchemaResolver(createInvoiceSchema) as Resolver<CreateInvoice>,
    defaultValues: defaultValue ?? emptyInvoice(),
    mode: 'onTouched',
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const errors = form.formState.errors

  return (
    <FormPage
      title="New invoice"
      description="A one-off invoice for a customer. Leave it as a draft to review, or finalize it now."
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode="create"
          noun="invoice"
          formId="invoice-create-form"
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      }
    >
      <form
        id="invoice-create-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
      >
        <FormCard>
          <FormRow label="Customer" required error={errors.customerId?.message}>
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="customerId"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={control.onChange}
                    options={customers}
                    placeholder="Choose a customer"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Currency" required error={errors.currency?.message}>
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="currency"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={control.onChange}
                    options={CURRENCIES}
                    placeholder="Choose a currency"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Due date" hint="Optional.">
            {({ id }) => (
              <Controller
                control={form.control}
                name="dueDate"
                render={({ field: control }) => (
                  <DateInput
                    id={id}
                    value={control.value}
                    onValueChange={control.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Description" align="start" error={errors.description?.message}>
            {({ id, ...field }) => (
              <Textarea
                id={id}
                rows={2}
                disabled={isSubmitting}
                {...field}
                {...form.register('description')}
              />
            )}
          </FormRow>
          <FormRow label="Line items" required align="start" error={errors.lines?.root?.message}>
            <div className="flex flex-col gap-3">
              {lines.fields.map((line, index) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_auto] items-start gap-2"
                >
                  <div className="flex flex-col gap-1">
                    <Input
                      aria-label={`Line ${index + 1} description`}
                      placeholder="Description"
                      disabled={isSubmitting}
                      {...form.register(`lines.${index}.description`)}
                    />
                    {errors.lines?.[index]?.description?.message ? (
                      <span className="text-destructive text-xs">
                        {errors.lines[index]?.description?.message}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    aria-label={`Line ${index + 1} quantity`}
                    inputMode="decimal"
                    placeholder="Qty"
                    disabled={isSubmitting}
                    {...form.register(`lines.${index}.quantity`)}
                  />
                  <Input
                    aria-label={`Line ${index + 1} amount`}
                    inputMode="decimal"
                    placeholder="Amount"
                    disabled={isSubmitting}
                    {...form.register(`lines.${index}.amount`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={isSubmitting || lines.fields.length === 1}
                    onClick={() => lines.remove(index)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={isSubmitting}
                onClick={() => lines.append({ description: '', quantity: '1', amount: '' })}
              >
                <PlusIcon aria-hidden /> Add line
              </Button>
            </div>
          </FormRow>
          <FormRow
            label="Invoice total"
            required
            hint="The amount the customer owes. Entered, not summed from the lines."
            error={errors.total?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="0.00"
                disabled={isSubmitting}
                {...field}
                {...form.register('total')}
              />
            )}
          </FormRow>
          <FormRow label="Finalize now" hint="Locks the invoice and sends it. Off keeps a draft.">
            {({ id }) => (
              <Controller
                control={form.control}
                name="finalize"
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
