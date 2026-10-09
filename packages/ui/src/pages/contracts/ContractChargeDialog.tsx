import { useState } from 'react'
import {
  formatMoney,
  type AddContractCharge,
  type EditContractCharge,
  type EndContractCharge,
  type SubscriptionLine,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'

export const ContractChargeDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'ui/input',
    'ui/field',
    '@reui/alert',
  ],
  note: 'One dialog for the three edits a contract allows on its charges: add a fixed charge, change a price, end a charge.',
})

/** Which edit is open, and on which charge. */
export type ContractChargeDialogState =
  | { mode: 'add' }
  | { mode: 'edit'; line: SubscriptionLine }
  | { mode: 'end'; line: SubscriptionLine }

export interface ContractChargeDialogProps {
  state: ContractChargeDialogState | null
  onClose: () => void
  currency: string
  onAdd: (draft: AddContractCharge) => void
  onEdit: (line: SubscriptionLine, draft: EditContractCharge) => void
  onEnd: (line: SubscriptionLine, draft: EndContractCharge) => void
  isSubmitting?: boolean
  submitError?: string | null
}

const AMOUNT = /^\d+(\.\d{1,8})?$/
const QUANTITY = /^[1-9]\d*$/

/**
 * Add, reprice or end one charge on a single contract. These calls touch only
 * this contract: a plan's own prices change on the plan page, and the dialog
 * says so on charges that came from the plan.
 */
export function ContractChargeDialog({
  state,
  onClose,
  currency,
  onAdd,
  onEdit,
  onEnd,
  isSubmitting = false,
  submitError = null,
}: ContractChargeDialogProps) {
  const title =
    state?.mode === 'add' ? 'Add charge' : state?.mode === 'edit' ? 'Edit price' : 'End charge'

  return (
    <FormDialog
      open={state !== null}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose()
      }}
      size="sm"
      title={title}
    >
      {state ? (
        <ChargeForm
          key={state.mode === 'add' ? 'add' : `${state.mode}:${state.line.id}`}
          state={state}
          currency={currency}
          onCancel={onClose}
          onAdd={onAdd}
          onEdit={onEdit}
          onEnd={onEnd}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : null}
    </FormDialog>
  )
}

function ChargeForm({
  state,
  currency,
  onCancel,
  onAdd,
  onEdit,
  onEnd,
  isSubmitting,
  submitError,
}: Omit<ContractChargeDialogProps, 'state' | 'onClose'> & {
  state: ContractChargeDialogState
  onCancel: () => void
}) {
  const line = state.mode === 'add' ? null : state.line
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(line && state.mode === 'edit' ? line.amount.amount : '')
  const [quantity, setQuantity] = useState('1')
  const [date, setDate] = useState('')
  const [touched, setTouched] = useState(false)

  const errors = {
    name: state.mode === 'add' && name.trim() === '' ? 'Enter a name.' : null,
    amount:
      state.mode !== 'end' && !AMOUNT.test(amount.trim())
        ? 'Enter an amount, such as 99 or 99.50.'
        : null,
    quantity:
      state.mode === 'add' && !QUANTITY.test(quantity.trim())
        ? 'Enter a whole number of 1 or more.'
        : null,
  }
  const invalid = Object.values(errors).some(Boolean)

  const submit = () => {
    setTouched(true)
    if (invalid) return
    if (state.mode === 'add') onAdd({ name, amount, quantity, startDate: date })
    else if (state.mode === 'edit') onEdit(state.line, { amount, effectiveFrom: date })
    else onEnd(state.line, { effectiveFrom: date })
  }

  const dateLabel =
    state.mode === 'add' ? 'Starts on' : state.mode === 'edit' ? 'Effective from' : 'Ends on'
  const dateHint =
    state.mode === 'add'
      ? 'Leave empty to start now.'
      : 'Leave empty to apply now. The change is prorated if the period is under way.'

  return (
    <Composer
      submitLabel={
        isSubmitting
          ? 'Saving…'
          : state.mode === 'add'
            ? 'Add charge'
            : state.mode === 'edit'
              ? 'Save price'
              : 'End charge'
      }
      submitting={isSubmitting ?? false}
      onCancel={onCancel}
      onSubmit={submit}
    >
      {line ? (
        <p className="text-muted-foreground text-sm">
          {state.mode === 'edit' ? 'Changing' : 'Ending'}{' '}
          <strong className="text-foreground">{line.name}</strong>, currently{' '}
          {formatMoney(line.amount)}.{' '}
          {line.source === 'plan'
            ? 'It comes from the plan. Only this contract changes; the plan keeps its price.'
            : 'Only this contract changes.'}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          A fixed charge, billed {currency ? `in ${currency} ` : ''}each billing period. Only this
          contract gets it.
        </p>
      )}

      <FieldGroup className="gap-4">
        {state.mode === 'add' ? (
          <Field className="gap-2">
            <FieldLabel htmlFor="charge-name">Name</FieldLabel>
            <Input
              id="charge-name"
              autoFocus
              value={name}
              disabled={isSubmitting}
              aria-invalid={touched && errors.name ? true : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {touched && errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>
        ) : null}

        {state.mode !== 'end' ? (
          <Field className="gap-2">
            <FieldLabel htmlFor="charge-amount">
              {state.mode === 'add' ? 'Price' : 'New price'}
              {currency ? ` (${currency})` : ''}
            </FieldLabel>
            <Input
              id="charge-amount"
              inputMode="decimal"
              value={amount}
              disabled={isSubmitting}
              aria-invalid={touched && errors.amount ? true : undefined}
              onChange={(event) => setAmount(event.target.value)}
            />
            {touched && errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
          </Field>
        ) : null}

        {state.mode === 'add' ? (
          <Field className="gap-2">
            <FieldLabel htmlFor="charge-quantity">Quantity</FieldLabel>
            <Input
              id="charge-quantity"
              inputMode="numeric"
              value={quantity}
              disabled={isSubmitting}
              aria-invalid={touched && errors.quantity ? true : undefined}
              onChange={(event) => setQuantity(event.target.value)}
            />
            {touched && errors.quantity ? <FieldError>{errors.quantity}</FieldError> : null}
          </Field>
        ) : null}

        <Field className="gap-2">
          <FieldLabel htmlFor="charge-date">{dateLabel}</FieldLabel>
          <Input
            id="charge-date"
            type="date"
            value={date}
            disabled={isSubmitting}
            onChange={(event) => setDate(event.target.value)}
          />
          <FieldDescription>{dateHint}</FieldDescription>
        </Field>
      </FieldGroup>

      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
    </Composer>
  )
}
