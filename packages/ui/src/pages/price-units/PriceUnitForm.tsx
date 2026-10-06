import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  PRICE_UNIT_CURRENCIES,
  type CreatePriceUnit,
  createPriceUnitSchema,
  emptyPriceUnit,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@ui/components/reui/number-field'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { provenance } from '@ui/provenance'
import { PriceUnitPreviewCard } from './PriceUnitPreviewCard'

/**
 * Create a price unit, on its own page.
 *
 * Presentational: it takes a default value and emits a validated
 * `CreatePriceUnit`, holding no state beyond the field values and never
 * importing `@fp/query`. The page wires it to a mutation.
 *
 * Create only. The backend fixes everything but the name once a unit exists, so
 * there is no edit page: the name is edited in place on the detail page, where
 * the other attributes are already shown read-only.
 */
export const PriceUnitFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/select',
    '@reui/number-field',
    'compositions/form-card',
    'compositions/form-page',
    'pages/price-unit-preview-card',
  ],
  note: 'RHF + the domain schema, in the shared full-page shell. The rate is a ReUI number field.',
})

export interface PriceUnitFormProps {
  defaultValue?: CreatePriceUnit
  onSubmit: (priceUnit: CreatePriceUnit) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
  trail: DetailCrumb[]
}

const FORM_ID = 'price-unit-form'

export function PriceUnitForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
}: PriceUnitFormProps) {
  const form = useForm<CreatePriceUnit>({
    resolver: standardSchemaResolver(createPriceUnitSchema) as Resolver<CreatePriceUnit>,
    defaultValues: defaultValue ?? emptyPriceUnit(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors
  const baseCurrency = form.watch('baseCurrency')
  const conversionRate = form.watch('conversionRate')
  const name = form.watch('name')
  const code = form.watch('code')
  const symbol = form.watch('symbol')

  return (
    <FormPage
      title="Create price unit"
      description="Define a unit to charge in — its code, symbol, and the rate it converts to a currency at. Only the name can change later."
      trail={trail}
      width="wide"
      preview={
        <PriceUnitPreviewCard
          name={name}
          code={code}
          symbol={symbol}
          baseCurrency={baseCurrency}
          conversionRate={typeof conversionRate === 'number' ? conversionRate : null}
        />
      }
      toolbar={{
        mode: 'create',
        noun: 'price unit',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="flex min-w-0 flex-col gap-6"
      >
        <FormCard
          title="Price unit"
          description="The unit, and the currency rate it converts into."
          status="required"
        >
          <FormRow
            label="Name"
            hint="What this custom currency is called."
            required
            error={errors.name?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </FormRow>

          <FormRow
            label="Code"
            required
            hint="A three-character code, such as CRD or TOK."
            error={errors.code?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                maxLength={3}
                disabled={isSubmitting}
                {...field}
                {...form.register('code')}
              />
            )}
          </FormRow>

          <FormRow
            label="Symbol"
            required
            hint="The glyph a rendered amount carries, such as ★."
            error={errors.symbol?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('symbol')} />
            )}
          </FormRow>

          <FormRow
            label="Base currency"
            required
            hint="The currency the rate converts into."
            error={errors.baseCurrency?.message}
          >
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
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
            )}
          </FormRow>

          <FormRow
            label="Conversion rate"
            required
            hint="How much of the base currency one unit is worth. Must be greater than zero."
            error={errors.conversionRate?.message}
          >
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
              <NumberField
                id={id}
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
                {/* `id` goes on the root NumberField, not the input: the
                  increment/decrement buttons' aria-controls reference the root's
                  id (axe aria-valid-attr-value). This matches ChargeForm. */}
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput
                    inputMode="decimal"
                    aria-label="Conversion rate"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}
