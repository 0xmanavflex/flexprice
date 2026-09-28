import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  PRICE_UNIT_CURRENCIES,
  type CreatePriceUnit,
  createPriceUnitSchema,
  emptyPriceUnit,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@ui/components/reui/number-field'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a price unit's details.
 *
 * Presentational, like every form here: it takes a default value and emits a
 * validated `CreatePriceUnit`, holding no state beyond the field values and
 * never importing `@fp/query`. The page wires it to a mutation.
 *
 * The backend fixes everything but the name once a unit exists — the code,
 * symbol, base currency and rate are what issued prices and integrations key
 * off. So on an edit those four are shown read-only (their values still visible,
 * because that is what the person came to check) and only the name is editable,
 * which is exactly the narrow payload `useUpdatePriceUnit` sends.
 */
export const PriceUnitFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/select', '@reui/number-field', 'ui/label'],
  note: 'RHF + the domain schema. The rate is a ReUI number field; the four immutable fields lock on edit.',
})

export interface PriceUnitFormProps {
  /** `create` allows every field; `edit` locks all but the name. */
  mode: 'create' | 'edit'
  defaultValue?: CreatePriceUnit
  onSubmit: (priceUnit: CreatePriceUnit) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

export function PriceUnitForm({
  mode,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: PriceUnitFormProps) {
  const form = useForm<CreatePriceUnit>({
    resolver: standardSchemaResolver(createPriceUnitSchema) as Resolver<CreatePriceUnit>,
    defaultValues: defaultValue ?? emptyPriceUnit(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors
  const isEdit = mode === 'edit'
  const baseCurrency = form.watch('baseCurrency')
  const conversionRate = form.watch('conversionRate')

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex min-h-full flex-col gap-6"
    >
      <Field label="Name" required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>

      <Field
        label="Code"
        required={!isEdit}
        hint={
          isEdit
            ? 'Fixed once created — issued prices key off it.'
            : 'A three-character code, such as CRD or TOK.'
        }
        error={errors.code?.message}
      >
        {({ id, ...field }) =>
          isEdit ? (
            <Input id={id} value={defaultValue?.code ?? ''} readOnly disabled />
          ) : (
            <Input
              id={id}
              maxLength={3}
              disabled={isSubmitting}
              {...field}
              {...form.register('code')}
            />
          )
        }
      </Field>

      <Field
        label="Symbol"
        required={!isEdit}
        hint={isEdit ? 'Fixed once created.' : 'The glyph a rendered amount carries, such as ★.'}
        error={errors.symbol?.message}
      >
        {({ id, ...field }) =>
          isEdit ? (
            <Input id={id} value={defaultValue?.symbol ?? ''} readOnly disabled />
          ) : (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('symbol')} />
          )
        }
      </Field>

      <Field
        label="Base currency"
        required={!isEdit}
        hint={isEdit ? 'Fixed once created.' : 'The currency the rate converts into.'}
        error={errors.baseCurrency?.message}
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) =>
          isEdit ? (
            <Input id={id} value={(defaultValue?.baseCurrency ?? '').toUpperCase()} readOnly disabled />
          ) : (
            <Select
              value={baseCurrency || undefined}
              onValueChange={(value) =>
                form.setValue('baseCurrency', value ?? '', {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={id}
                className="w-full"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                <SelectValue placeholder="Select a base currency" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_UNIT_CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      </Field>

      <Field
        label="Conversion rate"
        required={!isEdit}
        hint={
          isEdit
            ? 'Fixed once created.'
            : 'How much of the base currency one unit is worth. Must be greater than zero.'
        }
        error={errors.conversionRate?.message}
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) =>
          isEdit ? (
            <Input id={id} value={String(defaultValue?.conversionRate ?? '')} readOnly disabled />
          ) : (
            <NumberField
              value={conversionRate ?? null}
              onValueChange={(value) =>
                form.setValue('conversionRate', value as never, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              min={0}
              step={0.01}
              smallStep={0.001}
              largeStep={1}
              format={{ maximumFractionDigits: 8 }}
              disabled={isSubmitting}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput
                  id={id}
                  inputMode="decimal"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
          )
        }
      </Field>

      {/* Pinned to the bottom of the drawer: the actions sit on a divider at the
          foot of the panel rather than floating under the last field. */}
      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create price unit'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
