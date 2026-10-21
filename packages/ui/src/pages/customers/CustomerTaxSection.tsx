import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { useState } from 'react'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { PlusIcon } from '@ui/icons'
import {
  type CreateTaxAssociation,
  type EditTaxAssociation,
  type TaxAssociation,
  TAX_BEHAVIOR_LABEL,
  TaxBehavior,
  createTaxAssociationSchema,
  editTaxAssociationSchema,
  emptyTaxAssociation,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import {
  AppFailure,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingRows,
  OptionSelect,
  Section,
} from '../../compositions'
import { Composer } from '../../compositions/detail/DetailKit'
import { DetailTable } from '../shared/DetailTable'

export interface TaxRateOption {
  code: string
  label: string
}

export interface CustomerTaxSectionProps {
  associations: TaxAssociation[]
  taxRates: TaxRateOption[]
  isLoading: boolean
  failed: boolean
  onRetry: () => void
  onCreate: (draft: CreateTaxAssociation) => Promise<unknown>
  onUpdate: (id: string, draft: EditTaxAssociation) => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
  error: string | null
  onResetError: () => void
}

type Dialog = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'remove'; id: string } | null

const BEHAVIOR_OPTIONS = [TaxBehavior.Exclusive, TaxBehavior.Inclusive].map((value) => ({
  value,
  label: TAX_BEHAVIOR_LABEL[value],
}))

/** The tax rates attached to one customer: add, change priority/behavior, remove. */
function CustomerTaxSectionInner({
  associations,
  taxRates,
  isLoading,
  failed,
  onRetry,
  onCreate,
  onUpdate,
  onRemove,
  error,
  onResetError,
}: CustomerTaxSectionProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  const close = () => {
    setDialog(null)
    onResetError()
  }
  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    try {
      await action()
      setDialog(null)
    } catch {
      /* the wiring layer surfaces the message through `error` */
    } finally {
      setPending(false)
    }
  }
  const target =
    dialog && dialog.kind !== 'add' ? associations.find((a) => a.id === dialog.id) : undefined

  const addTaxRate = (
    <WriteGate>
      <Button
        variant="outline"
        size="sm"
        className="h-9 px-3"
        onClick={() => setDialog({ kind: 'add' })}
      >
        <PlusIcon aria-hidden /> Add tax rate
      </Button>
    </WriteGate>
  )

  return (
    <Section table showTitle title="Taxes" action={addTaxRate}>
      {isLoading ? (
        <div className="p-6">
          <LoadingRows />
        </div>
      ) : failed ? (
        <div className="p-6">
          <AppFailure
            title="Taxes could not be loaded"
            detail="The rest of this customer's record still works."
            onRetry={onRetry}
          />
        </div>
      ) : associations.length === 0 ? (
        <div className="p-6">
          <EmptyState
            scene="settings"
            size="inline"
            title="No tax rates attached"
            description="Add a rate to have it applied when this customer is invoiced."
          />
        </div>
      ) : (
        <DetailTable
          label="Tax rates"
          noun="tax rates"
          rows={associations}
          getRowId={(a) => a.id}
          columns={[
            {
              key: 'rate',
              header: 'Tax rate',
              cell: (a) => (
                <span className="flex flex-col">
                  <span className="font-medium">{a.taxRateName || a.taxRateCode}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {a.taxRateCode}
                    {a.percentage ? ` · ${a.percentage}%` : ''}
                  </span>
                </span>
              ),
            },
            {
              key: 'behavior',
              header: 'Behavior',
              cell: (a) => TAX_BEHAVIOR_LABEL[a.taxBehavior],
            },
            { key: 'priority', header: 'Priority', cell: (a) => String(a.priority) },
            { key: 'auto', header: 'Auto-apply', cell: (a) => (a.autoApply ? 'Yes' : 'No') },
            {
              key: 'actions',
              header: '',
              width: 168,
              cell: (a) => (
                <span className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${a.taxRateCode}`}
                    onClick={() => setDialog({ kind: 'edit', id: a.id })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${a.taxRateCode}`}
                    onClick={() => setDialog({ kind: 'remove', id: a.id })}
                  >
                    Remove
                  </Button>
                </span>
              ),
            },
          ]}
        />
      )}

      <TaxDialog
        key={dialog?.kind === 'edit' ? dialog.id : (dialog?.kind ?? 'closed')}
        open={dialog?.kind === 'add' || (dialog?.kind === 'edit' && target !== undefined)}
        mode={dialog?.kind === 'edit' ? 'edit' : 'add'}
        taxRates={taxRates}
        initial={
          target
            ? {
                taxRateCode: target.taxRateCode,
                taxBehavior: target.taxBehavior,
                priority: String(target.priority),
                autoApply: target.autoApply,
              }
            : emptyTaxAssociation()
        }
        pending={pending}
        error={error}
        onClose={close}
        onSubmit={(draft) =>
          run(() => (dialog?.kind === 'edit' ? onUpdate(dialog.id, draft) : onCreate(draft)))
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove' && target !== undefined}
        onOpenChange={(next) => (next ? undefined : close())}
        title="Remove this tax rate?"
        description={`${target?.taxRateName || target?.taxRateCode || 'This rate'} will no longer be applied to this customer's invoices.`}
        confirmLabel="Remove tax rate"
        destructive
        isPending={pending}
        error={error}
        onConfirm={() => target && void run(() => onRemove(target.id))}
      />
    </Section>
  )
}

export function TaxDialog({
  open,
  mode,
  subject = 'customer',
  taxRates,
  initial,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'add' | 'edit'
  /** What the rate is applied to, for the hint. */
  subject?: string
  taxRates: TaxRateOption[]
  initial: CreateTaxAssociation
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: CreateTaxAssociation) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (patch: Partial<CreateTaxAssociation>) =>
    setDraft((current) => ({ ...current, ...patch }))

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={mode === 'add' ? 'Add tax rate' : 'Edit tax rate'}
    >
      <Composer
        submitLabel={mode === 'add' ? 'Add tax rate' : 'Save changes'}
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const parsed =
            mode === 'add'
              ? createTaxAssociationSchema.safeParse(draft)
              : editTaxAssociationSchema.safeParse(draft)
          if (!parsed.success)
            return setProblem(parsed.error.issues[0]?.message ?? 'Check the form')
          setProblem(null)
          onSubmit(draft)
        }}
      >
        <div className="flex flex-col gap-2">
          <LabelWithHint htmlFor="tax-rate" hint={`The tax rate to apply to this ${subject}.`}>
            Tax rate
          </LabelWithHint>
          <OptionSelect
            id="tax-rate"
            value={draft.taxRateCode}
            onValueChange={(taxRateCode) => set({ taxRateCode })}
            options={taxRates.map((rate) => ({ value: rate.code, label: rate.label }))}
            disabled={mode === 'edit'}
          />
        </div>
        <div className="flex flex-col gap-2">
          <LabelWithHint
            htmlFor="tax-behavior"
            hint="Whether prices already include the tax or the tax is added on top."
          >
            Behavior
          </LabelWithHint>
          <OptionSelect
            id="tax-behavior"
            value={draft.taxBehavior}
            onValueChange={(taxBehavior) => set({ taxBehavior: taxBehavior as TaxBehavior })}
            options={BEHAVIOR_OPTIONS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <LabelWithHint
            htmlFor="tax-priority"
            hint="When several rates apply, the lower number is applied first."
          >
            Priority
          </LabelWithHint>
          <Input
            id="tax-priority"
            inputMode="numeric"
            value={draft.priority}
            onChange={(event) => set({ priority: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <LabelWithHint
            htmlFor="tax-auto"
            hint="Adds this rate to every new invoice for the customer without further steps."
          >
            Apply automatically to new invoices
          </LabelWithHint>
          <Switch
            id="tax-auto"
            checked={draft.autoApply}
            onCheckedChange={(autoApply) => set({ autoApply })}
          />
        </div>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

/** `CustomerTaxSection`, scoped to the entity it writes (Tax). */
export function CustomerTaxSection(props: Parameters<typeof CustomerTaxSectionInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.Tax}>
      <CustomerTaxSectionInner {...props} />
    </AccessScope>
  )
}
