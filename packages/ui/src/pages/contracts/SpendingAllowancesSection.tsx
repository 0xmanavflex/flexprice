import { useState } from 'react'
import { emptySpendingAllowance, spendingAllowanceSchema, type SpendingAllowance } from '@fp/domain'
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
  onSubmit,
  onCancel,
  pending = false,
  error,
  quotaOnly = false,
}: {
  initial?: SpendingAllowance | undefined
  onSubmit: (draft: SpendingAllowance) => void
  onCancel: () => void
  pending?: boolean
  error?: string | null
  quotaOnly?: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const set = <K extends keyof SpendingAllowance>(key: K, value: SpendingAllowance[K]) => {
    setProblem(null)
    setDraft((old) => ({ ...old, [key]: value }))
  }
  return (
    <Composer
      submitLabel="Save allowance"
      onCancel={onCancel}
      submitting={pending}
      onSubmit={() => {
        const parsed = spendingAllowanceSchema.safeParse(draft)
        if (!parsed.success) {
          setProblem(parsed.error.issues[0]?.message ?? 'Check the allowance')
          return
        }
        setProblem(null)
        onSubmit(parsed.data)
      }}
    >
      <Field
        label="Spending allowance"
        hint="An amount shared across all usage charges, in the contract’s currency."
        required
      >
        {({ id }) => (
          <Input
            id={id}
            inputMode="decimal"
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
              <Field label="Every" hint="Number of units in each window.">
                {({ id }) => (
                  <Input
                    id={id}
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
          <Field label="Stacking">
            {({ id }) => (
              <OptionSelect
                id={id}
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
            hint="Leave blank to start with the contract, or now for an existing contract."
          >
            {({ id }) => (
              <DateInput
                id={id}
                value={draft.startDate}
                onValueChange={(value) => set('startDate', value)}
              />
            )}
          </Field>
          <Field label="End date" hint="Leave blank for no end date.">
            {({ id }) => (
              <DateInput
                id={id}
                value={draft.endDate}
                onValueChange={(value) => set('endDate', value)}
              />
            )}
          </Field>
        </>
      ) : null}
      {problem || error ? (
        <p role="alert" className="text-destructive text-sm">
          {problem ?? error}
        </p>
      ) : null}
    </Composer>
  )
}

export function SpendingAllowancesSection({
  value,
  onChange,
}: {
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
              { key: 'amount', header: 'Amount', cell: (row) => row.quota },
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
