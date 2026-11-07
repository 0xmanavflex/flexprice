import { useState } from 'react'
import {
  emptySpendingAllowance,
  spendingAllowanceSchema,
  formatUnitAmount,
  type SpendingAllowance,
} from '@fp/domain'
import { PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { DetailTable } from '../shared/DetailTable'
import { provenance } from '@ui/provenance'

export const SpendingAllowancesSectionProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Section',
    'compositions/FormDialog',
    'compositions/Field',
    'pages/shared/DetailTable',
  ],
  note: 'Draft money allowances shared by every usage charge on the contract.',
})

export function SpendingAllowanceForm({
  initial = emptySpendingAllowance(),
  currency,
  creatingContract = false,
  onSubmit,
  onCancel,
  pending = false,
  error,
  quotaOnly = false,
}: {
  initial?: SpendingAllowance | undefined
  currency: string
  creatingContract?: boolean
  onSubmit: (draft: SpendingAllowance) => void
  onCancel: () => void
  pending?: boolean
  error?: string | null
  quotaOnly?: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<keyof SpendingAllowance, string>>>({})
  const set = <K extends keyof SpendingAllowance>(key: K, value: SpendingAllowance[K]) => {
    setProblems({})
    setDraft((old) => ({ ...old, [key]: value }))
  }
  return (
    <Composer
      noValidate
      submitLabel="Save allowance"
      onCancel={onCancel}
      submitting={pending}
      onSubmit={() => {
        if (pending) return
        const parsed = spendingAllowanceSchema.safeParse(draft)
        if (!parsed.success) {
          setProblems(
            Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])),
          )
          return
        }
        setProblems({})
        onSubmit(parsed.data)
      }}
    >
      <Field
        label={currency ? `Spending allowance (${currency.toUpperCase()})` : 'Spending allowance'}
        hint="An amount shared across all usage charges, in the contract’s currency."
        required
        error={problems.quota}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            {...field}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="For example 250"
            disabled={pending}
            value={draft.quota}
            onChange={(event) => set('quota', event.target.value)}
          />
        )}
      </Field>
      {!quotaOnly ? (
        <>
          <Field label="Usage resets">
            {({ id }) => (
              <OptionSelect
                id={id}
                disabled={pending}
                value={draft.unit}
                onValueChange={(value) => set('unit', value as SpendingAllowance['unit'])}
                options={[
                  { value: 'subscription_period', label: 'Every billing period' },
                  { value: 'hour', label: 'Hourly' },
                  { value: 'day', label: 'Daily' },
                  { value: 'week', label: 'Weekly' },
                ]}
              />
            )}
          </Field>
          {draft.unit !== 'subscription_period' ? (
            <>
              <Field
                label="Every"
                hint="Number of units in each window."
                error={problems.every}
                required
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    {...field}
                    disabled={pending}
                    type="number"
                    min={1}
                    step={1}
                    value={draft.every}
                    onChange={(event) => set('every', Number(event.target.value))}
                  />
                )}
              </Field>
              <Field label="Window starts">
                {({ id }) => (
                  <OptionSelect
                    id={id}
                    disabled={pending}
                    value={draft.allocation}
                    onValueChange={(value) =>
                      set('allocation', value as SpendingAllowance['allocation'])
                    }
                    options={[
                      { value: 'first_usage', label: 'On first usage' },
                      { value: 'unit_start', label: 'Calendar boundary' },
                    ]}
                  />
                )}
              </Field>
            </>
          ) : null}
          <Field
            label="Stacking"
            hint="Additive allowances are consumed in sequence. Parallel allowances apply to the same usage at the same time."
          >
            {({ id }) => (
              <OptionSelect
                id={id}
                disabled={pending}
                value={draft.aggregation}
                onValueChange={(value) =>
                  set('aggregation', value as SpendingAllowance['aggregation'])
                }
                options={[
                  { value: 'additive', label: 'Additive' },
                  { value: 'parallel', label: 'Parallel' },
                ]}
              />
            )}
          </Field>
          <Field
            label="Start date"
            hint={
              creatingContract
                ? 'Leave blank to start with the contract.'
                : 'Leave blank to start now.'
            }
            error={problems.startDate}
          >
            {({ id, ...field }) => (
              <DateInput
                id={id}
                {...field}
                disabled={pending}
                clearable
                clearLabel="Clear start date"
                value={draft.startDate}
                onValueChange={(value) => set('startDate', value)}
              />
            )}
          </Field>
          <Field label="End date" hint="Leave blank for no end date." error={problems.endDate}>
            {({ id, ...field }) => (
              <DateInput
                id={id}
                {...field}
                disabled={pending}
                clearable
                clearLabel="Clear end date"
                {...(draft.startDate ? { min: draft.startDate } : {})}
                value={draft.endDate}
                onValueChange={(value) => set('endDate', value)}
              />
            )}
          </Field>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </Composer>
  )
}

export function SpendingAllowancesSection({
  currency,
  value,
  onChange,
}: {
  currency: string
  value: SpendingAllowance[]
  onChange: (next: SpendingAllowance[]) => void
}) {
  const [edit, setEdit] = useState<number | 'new' | null>(null)
  return (
    <>
      <Section
        title="Spending allowances"
        action={
          <Button variant="outline" size="sm" onClick={() => setEdit('new')}>
            <PlusIcon aria-hidden />
            Add allowance
          </Button>
        }
      >
        {value.length === 0 ? (
          <SectionEmpty
            title="No spending allowances"
            description="Usage charges have no shared allowance."
          />
        ) : (
          <DetailTable
            label="Spending allowances"
            noun="allowances"
            rows={value}
            toolbar={false}
            columns={[
              {
                key: 'amount',
                header: 'Amount',
                cell: (row) => formatUnitAmount(row.quota, currency),
              },
              {
                key: 'window',
                header: 'Window',
                cell: (row) =>
                  row.unit === 'subscription_period'
                    ? 'Billing period'
                    : `Every ${row.every} ${row.unit}`,
              },
              {
                key: 'dates',
                header: 'Dates',
                cell: (row) => `${row.startDate || 'Contract start'} → ${row.endDate || 'No end'}`,
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => (
                  <RowActionsMenu
                    label="Allowance"
                    onEdit={() => setEdit(value.indexOf(row))}
                    onRemove={() => onChange(value.filter((item) => item !== row))}
                  />
                ),
              },
            ]}
          />
        )}
      </Section>
      <FormDialog
        open={edit !== null}
        onOpenChange={(open) => !open && setEdit(null)}
        title={edit === 'new' ? 'Add spending allowance' : 'Edit spending allowance'}
      >
        {edit !== null ? (
          <SpendingAllowanceForm
            key={edit}
            currency={currency}
            creatingContract
            initial={edit === 'new' ? emptySpendingAllowance() : value[edit]}
            onCancel={() => setEdit(null)}
            onSubmit={(draft) => {
              onChange(
                edit === 'new'
                  ? [...value, draft]
                  : value.map((row, index) => (index === edit ? draft : row)),
              )
              setEdit(null)
            }}
          />
        ) : null}
      </FormDialog>
    </>
  )
}
