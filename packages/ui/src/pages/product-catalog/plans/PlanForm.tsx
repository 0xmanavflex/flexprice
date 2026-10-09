import { useState, type ReactNode } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import {
  BILLING_PERIOD_LABEL,
  type CreateCharge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreatePlan,
  PriceType,
  createPlanSchema,
  emptyPlan,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import { useFormSteps } from '@ui/compositions/useFormSteps'
import { provenance } from '@ui/provenance'
import { ChargeForm, type MeterOption, type PriceUnitOption } from '../charges/ChargeForm'
import { CreditGrantCreateForm } from '../credit-grants/CreditGrantForm'
import { EntitlementCreateForm, type FeatureOption } from '../entitlements/EntitlementForm'

/**
 * Create or edit a plan, on a full page.
 *
 * Create is stepped: details, then the charges the plan bills, the entitlements
 * it includes and the credit grants it hands out. The details are one
 * react-hook-form over the domain schema; the three later steps *stage* drafts
 * in local state, each added through the same form the plan page uses in place
 * (`ChargeForm`, `EntitlementCreateForm`, `CreditGrantCreateForm`). Nothing is
 * saved until the last step: the caller receives the whole `PlanFormValue` and
 * writes the plan, then its children, with the hooks it already has.
 *
 * Edit is the same page with the details prepopulated. A plan's charges,
 * entitlements and grants already exist and are edited in place on the plan
 * page, so edit is the details step alone.
 *
 * Presentational: it does not fetch and cannot import `@fp/query`.
 */
export const PlanFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/form-steps',
    'compositions/form-card',
    'ui/input',
    'ui/textarea',
    'ui/button',
  ],
  note: 'Full-page stepped plan form: details plus staged charges, entitlements and credit grants. No preview rail (TODO(checkout-review): a preview returns only on a future checkout review screen).',
})

/** What a create emits: the plan and the children to write after it. */
export interface PlanFormValue {
  plan: CreatePlan
  charges: CreateCharge[]
  entitlements: CreateEntitlement[]
  creditGrants: CreateCreditGrant[]
}

export interface PlanFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreatePlan
  /** Existing plan name, for the edit title. */
  planName?: string
  trail: DetailCrumb[]
  step?: string | undefined
  onStepChange?: ((id: string) => void) | undefined
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  /** Features an entitlement can be granted on. */
  features?: FeatureOption[]
  onSubmit: (value: PlanFormValue) => void
  onCancel: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

const FORM_ID = 'plan-form'

const CREATE_STEPS = [
  { id: 'details', title: 'Basic info' },
  { id: 'charges', title: 'Charges' },
  { id: 'entitlements', title: 'Entitlements' },
  { id: 'credit-grants', title: 'Credit grants' },
] as const

const EDIT_STEPS = [{ id: 'details', title: 'Basic info' }] as const

export function PlanForm({
  mode,
  defaultValue,
  planName,
  trail,
  step,
  onStepChange,
  meters = [],
  priceUnits = [],
  features = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: PlanFormProps) {
  const isEdit = mode === 'edit'
  const form = useForm<CreatePlan>({
    resolver: standardSchemaResolver(createPlanSchema) as Resolver<CreatePlan>,
    defaultValues: defaultValue ?? emptyPlan(),
    mode: 'onTouched',
  })
  const errors = form.formState.errors

  const [charges, setCharges] = useState<CreateCharge[]>([])
  const [entitlements, setEntitlements] = useState<CreateEntitlement[]>([])
  const [grants, setGrants] = useState<CreateCreditGrant[]>([])
  const [adding, setAdding] = useState<null | 'charges' | 'entitlements' | 'credit-grants'>(null)

  const flow = useFormSteps({
    steps: isEdit ? EDIT_STEPS : CREATE_STEPS,
    step,
    onStepChange: (id) => {
      setAdding(null)
      onStepChange?.(id)
    },
    validate: (id) =>
      id === 'details' ? form.trigger(['name', 'lookupKey', 'description']) : true,
    unlockAll: isEdit,
  })

  const submitAll = form.handleSubmit((plan) =>
    onSubmit({ plan, charges, entitlements, creditGrants: grants }),
  )

  const featureName = (id: string) => features.find((f) => f.id === id)?.name ?? id
  const grantable = features.filter((f) => !entitlements.some((e) => e.featureId === f.id))

  const detailsStep = (
    <>
      <FormCard title="Plan details" status="required">
        <FormRow
          label="Name"
          hint="What the plan is called to customers and on invoices."
          required
          error={errors.name?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
          )}
        </FormRow>
        <FormRow
          label="Lookup key"
          hint="Optional stable identifier for the API. Lowercase, numbers and underscores."
          error={errors.lookupKey?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
          )}
        </FormRow>
        <FormRow
          label="Description"
          hint="Shown alongside the plan in the console. Optional."
          align="start"
          error={errors.description?.message}
        >
          {({ id, ...field }) => (
            <Textarea
              id={id}
              rows={3}
              disabled={isSubmitting}
              {...field}
              {...form.register('description')}
            />
          )}
        </FormRow>
      </FormCard>
      <p className="text-muted-foreground text-xs">
        {isEdit
          ? 'Charges, entitlements and credit grants are edited in place on the plan page.'
          : 'Next, add what the plan bills, includes and hands out. Each step is optional; all of it can also be added later from the plan page.'}
      </p>
    </>
  )

  const chargesStep = (
    <StagedStep
      title="Charges"
      emptyText="No charges added yet."
      addLabel="Add charge"
      adding={adding === 'charges'}
      onAdd={() => setAdding('charges')}
      onClose={() => setAdding(null)}
      items={charges.map((charge, index) => ({
        key: `${index}`,
        label:
          charge.displayName || (charge.type === PriceType.Usage ? 'Usage charge' : 'Fixed charge'),
        detail: `${'amount' in charge ? `${charge.amount} ` : ''}${charge.currency} · ${BILLING_PERIOD_LABEL[charge.billingPeriod]}`,
        onRemove: () => setCharges((rows) => rows.filter((_, i) => i !== index)),
      }))}
      form={
        <ChargeForm
          mode="create"
          meters={meters}
          priceUnits={priceUnits}
          submitLabel="Add charge"
          onSubmit={(charge) => {
            setCharges((rows) => [...rows, charge])
            setAdding(null)
          }}
        />
      }
    />
  )

  const entitlementsStep = (
    <StagedStep
      title="Entitlements"
      emptyText="No entitlements added yet."
      addLabel="Add entitlement"
      adding={adding === 'entitlements'}
      onAdd={() => setAdding('entitlements')}
      onClose={() => setAdding(null)}
      items={entitlements.map((entitlement, index) => ({
        key: entitlement.featureId,
        label: featureName(entitlement.featureId),
        detail: String(entitlement.featureType),
        onRemove: () => setEntitlements((rows) => rows.filter((_, i) => i !== index)),
      }))}
      form={
        <EntitlementCreateForm
          features={grantable}
          submitLabel="Add entitlement"
          onSubmit={(entitlement) => {
            setEntitlements((rows) => [...rows, entitlement])
            setAdding(null)
          }}
        />
      }
    />
  )

  const grantsStep = (
    <StagedStep
      title="Credit grants"
      emptyText="No credit grants added yet."
      addLabel="Add credit grant"
      adding={adding === 'credit-grants'}
      onAdd={() => setAdding('credit-grants')}
      onClose={() => setAdding(null)}
      items={grants.map((grant, index) => ({
        key: `${index}`,
        label: grant.name,
        detail: `${grant.credits} credits`,
        onRemove: () => setGrants((rows) => rows.filter((_, i) => i !== index)),
      }))}
      form={
        <CreditGrantCreateForm
          submitLabel="Add credit grant"
          onSubmit={(grant) => {
            setGrants((rows) => [...rows, grant])
            setAdding(null)
          }}
        />
      }
    />
  )

  const content: Record<string, ReactNode> = {
    details: detailsStep,
    charges: chargesStep,
    entitlements: entitlementsStep,
    'credit-grants': grantsStep,
  }
  const inForm = flow.step === 'details'

  return (
    <FormPage
      title={isEdit ? `Edit ${planName ?? 'plan'}` : 'Create plan'}
      trail={trail}
      toolbar={{
        mode,
        noun: 'plan',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
        hideSubmit: Boolean(adding),
      }}
      stepper={{ flow, label: 'Plan steps', hideNav: Boolean(adding) }}
    >
      {/* The staged steps hold their own forms, which cannot nest in this one, so
          the plan form is rendered around the details fields only. The toolbar's
          submit reaches it by `form={FORM_ID}` on every step. */}
      <form
        id={FORM_ID}
        onSubmit={flow.guardSubmit(submitAll)}
        noValidate
        className="flex flex-col gap-4"
      >
        {inForm ? content['details'] : null}
      </form>
      {inForm ? null : content[flow.step]}
    </FormPage>
  )
}

interface StagedItem {
  key: string
  label: string
  detail: string
  onRemove: () => void
}

/** One staged-children step: the drafts so far, and the in-place form to add another. */
function StagedStep({
  title,
  emptyText,
  addLabel,
  items,
  adding,
  onAdd,
  onClose,
  form,
}: {
  title: string
  emptyText: string
  addLabel: string
  items: StagedItem[]
  adding: boolean
  onAdd: () => void
  /** Closes the in-place form without adding; the sub-forms draw no Cancel of their own. */
  onClose: () => void
  form: ReactNode
}) {
  return (
    <FormCard title={title} status="optional">
      {items.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{item.label}</span>
                <span className="text-muted-foreground truncate text-xs">{item.detail}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.label}`}
                onClick={item.onRemove}
              >
                <Trash2Icon aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-4 sm:px-6">
        {adding ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{addLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Close ${addLabel.toLowerCase()}`}
                onClick={onClose}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            {form}
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-fit" onClick={onAdd}>
            <PlusIcon aria-hidden className="size-4" />
            {addLabel}
          </Button>
        )}
      </div>
    </FormCard>
  )
}
