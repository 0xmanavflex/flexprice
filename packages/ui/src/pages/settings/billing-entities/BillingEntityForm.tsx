import { useMemo } from 'react'
import { Controller, useFieldArray, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type BillingEntityDraft,
  billingEntitySchema,
  countryOptions,
  emptyBillingEntity,
  RBAC_ENTITY,
} from '@fp/domain'
import { PlusIcon, Trash2Icon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { AddressPicker, useAddressRegions } from '@ui/compositions/forms/AddressRegionFields'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { WriteGate } from '@ui/compositions/access/Access'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a billing entity: the entity's names, how its invoices are
 * numbered (with a live example), the seller details printed on them and its
 * tax IDs.
 *
 * Presentational. Create is a full page; edit is the same cards inside the
 * detail page's Details tab, with a Save changes button under them. It emits
 * the schema-parsed draft, so trimmed values are what reach the API.
 */
export const BillingEntityFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/form-card',
    'compositions/address-region-fields',
    'compositions/option-combobox',
    'ui/input',
  ],
  note: 'RHF + the domain schema: Entity, Invoice numbering (example number), Seller details (address pickers) and a repeatable Tax IDs card. Create is a FormPage; edit renders the cards in place with Save changes.',
})

export interface BillingEntityFormProps {
  mode: 'create' | 'edit'
  defaultValue?: BillingEntityDraft
  /** The example invoice number for a prefix. */
  preview: (prefix: string) => string
  onSubmit: (draft: BillingEntityDraft) => void
  /** The way back from the create page. */
  onCancel?: () => void
  isSubmitting?: boolean
  /** Create only: the way back, then this form. */
  trail?: DetailCrumb[]
}

const FORM_ID = 'billing-entity-form'
const PREFIX_MAX = 20

export function BillingEntityForm({
  mode,
  defaultValue,
  preview,
  onSubmit,
  onCancel,
  isSubmitting = false,
  trail = [],
}: BillingEntityFormProps) {
  const isEdit = mode === 'edit'
  const form = useCalmForm<BillingEntityDraft>({
    resolver: standardSchemaResolver(billingEntitySchema) as Resolver<BillingEntityDraft>,
    defaultValues: defaultValue ?? emptyBillingEntity(),
  })
  const errors = form.formState.errors
  const taxIds = useFieldArray({ control: form.control, name: 'taxIdentifiers' })
  const countries = useMemo(
    () => countryOptions().map((country) => ({ value: country.code, label: country.label })),
    [],
  )

  const [prefix = '', country = '', state = '', city = ''] = form.watch([
    'invoiceNumberPrefix',
    'seller.address.country',
    'seller.address.state',
    'seller.address.city',
  ])
  const regions = useAddressRegions({
    value: { country, state, city },
    onChange: (next) => {
      const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted }
      form.setValue('seller.address.country', next.country, options)
      form.setValue('seller.address.state', next.state, options)
      form.setValue('seller.address.city', next.city, options)
    },
    disabled: isSubmitting,
  })

  const submit = form.handleSubmit((values) => onSubmit(values))
  const trimmedPrefix = prefix.trim()
  const example =
    trimmedPrefix && trimmedPrefix.length <= PREFIX_MAX ? preview(trimmedPrefix) : null

  const cards = (
    <div className="flex flex-col gap-5">
      <FormCard title="Entity" status="required">
        <FormRow
          label="Name"
          hint="How this entity is named in the console."
          required
          error={errors.name?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
          )}
        </FormRow>
        <FormRow
          label="Legal name"
          hint="The registered name printed on invoices."
          required
          error={errors.legalName?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('legalName')} />
          )}
        </FormRow>
      </FormCard>

      <FormCard title="Invoice numbering" status="required">
        <FormRow
          label="Invoice prefix"
          hint="Opens every invoice number this entity issues. Unique in this environment."
          required
          error={errors.invoiceNumberPrefix?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting}
              {...field}
              {...form.register('invoiceNumberPrefix')}
            />
          )}
        </FormRow>
        <FormRow
          label="Example invoice number"
          hint="The environment's numbering scheme with this prefix. The live sequence continues from wherever this environment has reached."
        >
          {example ? (
            <code
              data-testid="invoice-number-example"
              className="text-foreground font-mono text-sm"
            >
              {example}
            </code>
          ) : (
            <span className="text-muted-foreground text-sm">Enter a prefix to see an example.</span>
          )}
        </FormRow>
      </FormCard>

      <FormCard
        title="Seller details"
        status="optional"
        description="Printed on invoices as the seller."
      >
        <FormRow label="Email" error={errors.seller?.email?.message}>
          {({ id, ...field }) => (
            <Input
              id={id}
              type="email"
              disabled={isSubmitting}
              {...field}
              {...form.register('seller.email')}
            />
          )}
        </FormRow>
        <FormRow label="Help email" hint="Where customers send billing questions.">
          {({ id, ...field }) => (
            <Input
              id={id}
              type="email"
              disabled={isSubmitting}
              {...field}
              {...form.register('seller.helpEmail')}
            />
          )}
        </FormRow>
        <FormRow label="Phone">
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('seller.phone')} />
          )}
        </FormRow>
        <FormRow label="Address line 1">
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting}
              {...field}
              {...form.register('seller.address.line1')}
            />
          )}
        </FormRow>
        <FormRow label="Address line 2" hint="Suite or unit. Optional.">
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting}
              {...field}
              {...form.register('seller.address.line2')}
            />
          )}
        </FormRow>
        <FormRow label="Country" hint="Stored as the two-letter code; search by name.">
          {({ id, ...field }) => (
            <AddressPicker picker={regions.country} id={id} {...field} autoComplete="country" />
          )}
        </FormRow>
        <FormRow label="State" hint="State, province or region, from the chosen country.">
          {({ id, ...field }) => (
            <AddressPicker
              picker={regions.state}
              id={id}
              {...field}
              autoComplete="address-level1"
            />
          )}
        </FormRow>
        <FormRow label="City" hint="City or town, from the chosen state.">
          {({ id, ...field }) => (
            <AddressPicker picker={regions.city} id={id} {...field} autoComplete="address-level2" />
          )}
        </FormRow>
        <FormRow label="Postal code">
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting}
              {...field}
              {...form.register('seller.address.postalCode')}
            />
          )}
        </FormRow>
      </FormCard>

      <FormCard
        title="Tax IDs"
        status="optional"
        description="Printed on invoices as the seller's tax registrations."
        adornment={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={isSubmitting}
            onClick={() => taxIds.append({ type: '', value: '', country: '' })}
          >
            <PlusIcon aria-hidden /> Add tax ID
          </Button>
        }
      >
        {taxIds.fields.map((entry, index) => (
          <FormRow key={entry.id} label={`Tax ID ${index + 1}`}>
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Tax ID ${index + 1} type`}
                placeholder="Type, e.g. GSTIN"
                disabled={isSubmitting}
                {...form.register(`taxIdentifiers.${index}.type`)}
              />
              <Input
                aria-label={`Tax ID ${index + 1} value`}
                placeholder="Value"
                disabled={isSubmitting}
                {...form.register(`taxIdentifiers.${index}.value`)}
              />
              <Controller
                control={form.control}
                name={`taxIdentifiers.${index}.country`}
                render={({ field }) => (
                  <OptionCombobox
                    aria-label={`Tax ID ${index + 1} country`}
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    options={countries}
                    placeholder="Country"
                    disabled={isSubmitting}
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove tax ID ${index + 1}`}
                disabled={isSubmitting}
                onClick={() => taxIds.remove(index)}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          </FormRow>
        ))}
      </FormCard>
    </div>
  )

  const formEl = (
    <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate>
      {cards}
    </form>
  )

  if (isEdit) {
    return (
      <div className="flex flex-col gap-5">
        {formEl}
        <div className="flex justify-end">
          <WriteGate entity={RBAC_ENTITY.Setting}>
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </WriteGate>
        </div>
      </div>
    )
  }

  return (
    <FormPage
      title="New billing entity"
      trail={trail}
      toolbar={{
        mode,
        noun: 'billing entity',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
      }}
    >
      {formEl}
    </FormPage>
  )
}
