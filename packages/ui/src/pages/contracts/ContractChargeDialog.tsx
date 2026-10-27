import { useState } from 'react'
import { CircleAlertIcon, GaugeIcon, RepeatIcon } from '@ui/icons'
import {
  type AddContractCharge,
  type BillingPeriod,
  BillingPeriod as Period,
  type EditContractCharge,
  type EndContractCharge,
  PriceType,
  type SubscriptionLine,
  formatMoney,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Composer, ChoiceCards } from '@ui/compositions/detail/DetailKit'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ui/components/primitives/field'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'
import type { MeterOption, PriceUnitOption } from '../product-catalog/charges/ChargeForm'
import { ContractAddChargeForm } from './ContractAddChargeForm'
import { ContractUsageEditForm } from './ContractUsageEditForm'

export const ContractChargeDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'pages/ContractAddChargeForm',
    'pages/ContractUsageEditForm',
    'compositions/date-input',
    'ui/field',
    '@reui/alert',
  ],
  note: 'One dialog for the edits a contract allows on its charges: add a fixed or metered charge, edit a metered charge, end a charge. Fixed charges are edited through the quantity dialog.',
})

/** Which edit is open, and on which charge. */
export type ContractChargeDialogState =
  | { mode: 'add'; initial?: AddContractCharge | undefined }
  | { mode: 'edit'; line: SubscriptionLine }
  | { mode: 'end'; line: SubscriptionLine }

export interface ContractChargeDialogProps {
  state: ContractChargeDialogState | null
  onClose: () => void
  currency: string
  /** The contract's billing period, which a new charge starts on. */
  billingPeriod?: BillingPeriod | null
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  onAdd: (draft: AddContractCharge) => void
  onEdit: (line: SubscriptionLine, draft: EditContractCharge) => void
  onEnd: (line: SubscriptionLine, draft: EndContractCharge) => void
  isSubmitting?: boolean
  submitError?: string | null
  /** The contract's start when still in the future (see `ContractAddChargeForm`). */
  earliestStart?: string | undefined
  /** The add dialog's title and its opening line, where a caller words them its own way. */
  addTitle?: string
  addDescription?: string
}

/**
 * Add, edit or end one charge on a single contract. These calls touch only
 * this contract: a plan's own prices change on the plan page, and the dialog
 * says so on charges that came from the plan.
 */
export function ContractChargeDialog({
  state,
  onClose,
  currency,
  billingPeriod = null,
  meters = [],
  priceUnits = [],
  onAdd,
  onEdit,
  onEnd,
  isSubmitting = false,
  submitError = null,
  earliestStart,
  addTitle = 'Add charge',
  addDescription = 'Only this contract gets the charge; the plan does not change.',
}: ContractChargeDialogProps) {
  const title =
    state?.mode === 'add'
      ? state.initial
        ? 'Edit charge'
        : addTitle
      : state?.mode === 'edit'
        ? 'Edit charge'
        : 'End charge'

  return (
    <FormDialog
      open={state !== null}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose()
      }}
      size={state?.mode === 'end' ? 'sm' : 'lg'}
      title={title}
    >
      {state?.mode === 'add' ? (
        <AddStep
          key="add"
          initial={state.initial}
          description={addDescription}
          currency={currency}
          billingPeriod={billingPeriod ?? Period.Monthly}
          meters={meters}
          priceUnits={priceUnits}
          onCancel={onClose}
          onAdd={onAdd}
          isSubmitting={isSubmitting}
          submitError={submitError}
          earliestStart={earliestStart}
        />
      ) : state?.mode === 'edit' ? (
        <ContractUsageEditForm
          key={`edit:${state.line.id}`}
          line={state.line}
          currency={currency}
          billingPeriod={billingPeriod ?? Period.Monthly}
          meters={meters}
          priceUnits={priceUnits}
          onSubmit={(draft) => onEdit(state.line, draft)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : state?.mode === 'end' ? (
        <EndForm
          key={`end:${state.line.id}`}
          line={state.line}
          onCancel={onClose}
          onEnd={onEnd}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : null}
    </FormDialog>
  )
}

/** First step: fixed or metered. The form that follows is the granular one for that type. */
function AddStep({
  initial,
  description,
  currency,
  billingPeriod,
  meters,
  priceUnits,
  onCancel,
  onAdd,
  isSubmitting,
  submitError,
  earliestStart,
}: {
  /** A drafted charge to change: skips the type choice. */
  initial?: AddContractCharge | undefined
  description: string
  currency: string
  billingPeriod: BillingPeriod
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
  onCancel: () => void
  onAdd: (draft: AddContractCharge) => void
  isSubmitting: boolean
  submitError: string | null
  earliestStart?: string | undefined
}) {
  const [type, setType] = useState<PriceType>(initial?.charge.type ?? PriceType.Fixed)
  const [chosen, setChosen] = useState(Boolean(initial))

  if (chosen) {
    return (
      <ContractAddChargeForm
        key={type}
        type={type}
        initial={initial}
        currency={currency}
        billingPeriod={billingPeriod}
        meters={meters}
        priceUnits={priceUnits}
        onSubmit={onAdd}
        isSubmitting={isSubmitting}
        submitError={submitError}
        earliestStart={earliestStart}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">{description}</p>
      <ChoiceCards
        label="Charge type"
        value={type}
        onChange={setType}
        choices={[
          {
            value: PriceType.Fixed,
            title: 'Fixed',
            description: 'A flat fee, billed each period for a quantity.',
            icon: <RepeatIcon aria-hidden className="text-muted-foreground size-4" />,
          },
          {
            value: PriceType.Usage,
            title: 'Usage',
            description: 'Billed at the end of the period for what was used.',
            icon: <GaugeIcon aria-hidden className="text-muted-foreground size-4" />,
          },
        ]}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => setChosen(true)}>
          Continue
        </Button>
      </div>
    </div>
  )
}

function EndForm({
  line,
  onCancel,
  onEnd,
  isSubmitting,
  submitError,
}: {
  line: SubscriptionLine
  onCancel: () => void
  onEnd: (line: SubscriptionLine, draft: EndContractCharge) => void
  isSubmitting: boolean
  submitError: string | null
}) {
  const [date, setDate] = useState('')

  return (
    <Composer
      submitLabel={isSubmitting ? 'Saving…' : 'End charge'}
      submitting={isSubmitting}
      onCancel={onCancel}
      onSubmit={() => onEnd(line, { effectiveFrom: date })}
    >
      <p className="text-muted-foreground text-sm">
        Ending <strong className="text-foreground">{line.name}</strong>, currently{' '}
        {formatMoney(line.amount)}.{' '}
        {line.source === 'plan'
          ? 'It comes from the plan. Only this contract stops paying for it.'
          : 'Only this contract changes.'}
      </p>
      <FieldGroup className="gap-4">
        <Field className="gap-2">
          <FieldLabel htmlFor="charge-date">Ends on</FieldLabel>
          <DateInput
            id="charge-date"
            value={date}
            disabled={isSubmitting}
            clearable
            clearLabel="Clear end date"
            placeholder="Now"
            onValueChange={setDate}
          />
          <FieldDescription>
            Leave empty to end now. The change is prorated if the period is under way.
          </FieldDescription>
        </Field>
      </FieldGroup>
      {submitError ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
    </Composer>
  )
}
