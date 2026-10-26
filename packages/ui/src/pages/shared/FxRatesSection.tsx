import { useState } from 'react'
import {
  type FxRate,
  type FxRateDraft,
  FX_OVERRIDE_STATUS_LABEL,
  RBAC_ENTITY,
  currencyCodes,
  emptyFxRateDraft,
  formatFxPair,
  formatFxRate,
  fxOverrideStatus,
  fxRateDraftSchema,
  fxRateToDraft,
  fxWindowsOverlap,
} from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { PlusIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'
import { AppFailure, ConfirmDialog, EmptyState, LoadingRows } from '../../compositions'
import { FormDialog } from '../../compositions/forms/FormDialog'
import { Section } from '../../compositions/layout/Section'
import { Composer } from '../../compositions/detail/DetailKit'
import { DateInput } from '../../compositions/forms/DateInput'
import { Field } from '../../compositions/forms/Field'
import { OptionCombobox } from '../../compositions/forms/OptionCombobox'
import { Status } from './cells'
import { DetailTable } from './DetailTable'
import { RowActionsMenu } from './RowActionsMenu'

export const FxRatesSectionProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/section',
    'pages/shared/detail-table',
    'pages/shared/row-actions-menu',
    'compositions/form-dialog',
    'compositions/field',
    'compositions/date-input',
  ],
  note: "Forex rates as V1 has them: the global rate per pair (Settings › Currency) and a customer's or contract's overrides of it, each with a window and a status. One section for all three; add and edit in a FormDialog.",
})

export interface FxRatesSectionProps {
  /** `global`: one rate per pair, no window, not removable. `override`: windowed, removable. */
  kind: 'global' | 'override'
  rates: FxRate[]
  isLoading: boolean
  failed: boolean
  onRetry: () => void
  onCreate: (draft: FxRateDraft) => Promise<unknown>
  onUpdate: (id: string, original: FxRateDraft, next: FxRateDraft) => Promise<unknown>
  /** Overrides only. */
  onRemove?: ((id: string) => Promise<unknown>) | undefined
  /** The API's refusal, shown in the open dialog. */
  error: string | null
  onResetError: () => void
  /** Both set: new rates use this pair (a contract converts from its own currency). */
  lockedFrom?: string | undefined
  /** What uses the override when there is none, for the empty state. */
  emptyDescription?: string | undefined
  /** Rows stay visible; Add and the row menu are not offered (an archived customer). */
  readOnly?: boolean | undefined
}

type Dialog = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'remove'; id: string } | null

const CURRENCIES = currencyCodes().map((code) => ({ value: code.toLowerCase(), label: code }))

const dateText = (value: string | null, fallback: string) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : fallback

function FxRatesSectionInner({
  kind,
  rates,
  isLoading,
  failed,
  onRetry,
  onCreate,
  onUpdate,
  onRemove,
  error,
  onResetError,
  lockedFrom,
  emptyDescription,
  readOnly = false,
}: FxRatesSectionProps) {
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
  const target = dialog && dialog.kind !== 'add' ? rates.find((r) => r.id === dialog.id) : undefined
  const global = kind === 'global'
  const title = global ? 'Forex rates' : 'FX overrides'
  const addLabel = global ? 'Add rate' : 'Add override'

  const add = readOnly ? undefined : (
    <WriteGate>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-3"
        onClick={() => setDialog({ kind: 'add' })}
      >
        <PlusIcon aria-hidden /> {addLabel}
      </Button>
    </WriteGate>
  )

  const actions = {
    key: 'actions',
    header: '',
    width: 56,
    cell: (rate: FxRate) =>
      readOnly ? null : (
        <RowActionsMenu
          label={formatFxPair(rate.fromCurrency, rate.toCurrency)}
          onEdit={() => setDialog({ kind: 'edit', id: rate.id })}
          {...(!global && onRemove
            ? { onRemove: () => setDialog({ kind: 'remove', id: rate.id }), removeLabel: 'Delete' }
            : {})}
        />
      ),
  }

  return (
    <Section table showTitle title={title} {...(add ? { action: add } : {})}>
      {isLoading ? (
        <div className="p-6">
          <LoadingRows />
        </div>
      ) : failed ? (
        <div className="p-6">
          <AppFailure
            title={`${title} could not be loaded`}
            detail="The rest of this page still works."
            onRetry={onRetry}
          />
        </div>
      ) : rates.length === 0 ? (
        <div className="p-6">
          <EmptyState
            scene="settings"
            size="inline"
            title={global ? 'No forex rates yet' : 'No FX overrides'}
            description={
              emptyDescription ??
              (global
                ? "Add the rate used when a customer is billed in a different currency from the price's."
                : 'The global forex rate applies.')
            }
          />
        </div>
      ) : (
        <DetailTable
          label={title}
          noun={global ? 'rates' : 'overrides'}
          rows={rates}
          getRowId={(rate) => rate.id}
          compact
          toolbar={false}
          columns={
            global
              ? [
                  {
                    key: 'rate',
                    header: 'Rate',
                    cell: (rate) => formatFxRate(rate.fromCurrency, rate.toCurrency, rate.rate),
                  },
                  {
                    key: 'updated',
                    header: 'Last updated',
                    cell: (rate) =>
                      rate.updatedAt
                        ? rate.updatedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })
                        : '—',
                  },
                  actions,
                ]
              : [
                  {
                    key: 'rate',
                    header: 'Rate',
                    cell: (rate) => formatFxRate(rate.fromCurrency, rate.toCurrency, rate.rate),
                  },
                  {
                    key: 'from',
                    header: 'Valid from',
                    cell: (rate) => dateText(rate.startDate, 'Always'),
                  },
                  {
                    key: 'until',
                    header: 'Valid until',
                    cell: (rate) => dateText(rate.endDate, 'No end'),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (rate) => (
                      <Status
                        value={
                          FX_OVERRIDE_STATUS_LABEL[fxOverrideStatus(rate.startDate, rate.endDate)]
                        }
                      />
                    ),
                  },
                  actions,
                ]
          }
        />
      )}

      <FxRateDialog
        key={dialog?.kind === 'edit' ? dialog.id : (dialog?.kind ?? 'closed')}
        open={dialog?.kind === 'add' || (dialog?.kind === 'edit' && target !== undefined)}
        mode={dialog?.kind === 'edit' ? 'edit' : 'add'}
        global={global}
        initial={target ? fxRateToDraft(target) : emptyFxRateDraft(lockedFrom ?? '')}
        lockedFrom={lockedFrom}
        others={rates.filter((rate) => rate.id !== target?.id)}
        pending={pending}
        error={error}
        onClose={close}
        onSubmit={(draft) =>
          run(() =>
            dialog?.kind === 'edit' && target
              ? onUpdate(target.id, fxRateToDraft(target), draft)
              : onCreate(draft),
          )
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove' && target !== undefined}
        onOpenChange={(next) => (next ? undefined : close())}
        title="Delete this FX override?"
        description={`${target ? formatFxRate(target.fromCurrency, target.toCurrency, target.rate) : 'This override'} will no longer apply; invoices fall back to the next rate up. Issued invoices do not change.`}
        confirmLabel="Delete override"
        destructive
        isPending={pending}
        error={error}
        onConfirm={() => target && onRemove && void run(() => onRemove(target.id))}
      />
    </Section>
  )
}

const WINDOW_HINT =
  'A blank start has no start limit and a blank end means no expiry. The window is matched when an invoice is finalized or a checkout is created.'
const EDIT_WINDOW_HINT =
  'A saved date can be changed but not cleared. To remove one, delete this override and add a new one.'

function FxRateDialog({
  open,
  mode,
  global,
  initial,
  lockedFrom,
  others,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'add' | 'edit'
  global: boolean
  initial: FxRateDraft
  lockedFrom: string | undefined
  others: FxRate[]
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: FxRateDraft) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<keyof FxRateDraft, string>>>({})
  const set = (patch: Partial<FxRateDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setProblems({})
  }
  const edit = mode === 'edit'
  const pairFixed = edit
  const fromFixed = edit || Boolean(lockedFrom)
  const preview =
    /^\d+(\.\d+)?$/.test(draft.rate.trim()) &&
    Number(draft.rate) > 0 &&
    draft.fromCurrency &&
    draft.toCurrency
      ? formatFxRate(draft.fromCurrency, draft.toCurrency, draft.rate.trim())
      : null

  const submit = () => {
    const parsed = fxRateDraftSchema.safeParse(draft)
    const next: Partial<Record<keyof FxRateDraft, string>> = {}
    for (const issue of parsed.error?.issues ?? []) {
      const key = issue.path[0] as keyof FxRateDraft
      next[key] ??= issue.message
    }
    // One pair's override windows must not overlap, as the API refuses.
    if (!global && Object.keys(next).length === 0) {
      const window = { startDate: draft.startDate || null, endDate: draft.endDate || null }
      const clash = others.some(
        (rate) =>
          rate.fromCurrency === draft.fromCurrency.toLowerCase() &&
          rate.toCurrency === draft.toCurrency.toLowerCase() &&
          fxWindowsOverlap(rate, window),
      )
      if (clash) next.endDate = 'Overlaps another override for this pair.'
    }
    setProblems(next)
    if (Object.keys(next).length === 0) onSubmit({ ...draft, rate: draft.rate.trim() })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={
        edit
          ? global
            ? 'Edit forex rate'
            : 'Edit FX override'
          : global
            ? 'Add forex rate'
            : 'Add FX override'
      }
    >
      <Composer
        submitLabel={edit ? 'Save changes' : global ? 'Add rate' : 'Add override'}
        onCancel={onClose}
        submitting={pending}
        onSubmit={submit}
      >
        {pairFixed ? (
          <Field label="Currency pair">
            {({ id }) => (
              <Input
                id={id}
                value={formatFxPair(draft.fromCurrency, draft.toCurrency)}
                readOnly
                disabled
              />
            )}
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {fromFixed ? (
              <Field label="From currency" hint="A contract converts from its own currency.">
                {({ id }) => (
                  <Input id={id} value={draft.fromCurrency.toUpperCase()} readOnly disabled />
                )}
              </Field>
            ) : (
              <Field label="From currency" error={problems.fromCurrency}>
                {({ id, ...field }) => (
                  <OptionCombobox
                    id={id}
                    {...field}
                    value={draft.fromCurrency}
                    onValueChange={(fromCurrency) =>
                      set({
                        fromCurrency,
                        ...(draft.toCurrency === fromCurrency ? { toCurrency: '' } : {}),
                      })
                    }
                    options={CURRENCIES}
                    searchable
                    placeholder="Select currency"
                  />
                )}
              </Field>
            )}
            <Field label="To currency" error={problems.toCurrency}>
              {({ id, ...field }) => (
                <OptionCombobox
                  id={id}
                  {...field}
                  value={draft.toCurrency}
                  onValueChange={(toCurrency) => set({ toCurrency })}
                  options={CURRENCIES.filter((option) => option.value !== draft.fromCurrency)}
                  searchable
                  placeholder="Select currency"
                />
              )}
            </Field>
          </div>
        )}

        <Field
          label="Rate"
          hint={preview ?? 'One unit of the From currency, in the To currency.'}
          error={problems.rate}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              {...field}
              inputMode="decimal"
              placeholder="83.00"
              value={draft.rate}
              onChange={(event) => set({ rate: event.target.value })}
            />
          )}
        </Field>

        {global ? null : (
          <div className="flex flex-col gap-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid from">
                {({ id, ...field }) => (
                  <DateInput
                    id={id}
                    {...field}
                    withTime
                    value={draft.startDate}
                    onValueChange={(startDate) => set({ startDate })}
                    placeholder="Always"
                    clearable={!edit || !initial.startDate}
                    clearLabel="Clear start"
                  />
                )}
              </Field>
              <Field label="Valid until" error={problems.endDate}>
                {({ id, ...field }) => (
                  <DateInput
                    id={id}
                    {...field}
                    withTime
                    value={draft.endDate}
                    onValueChange={(endDate) => set({ endDate })}
                    placeholder="No end"
                    clearable={!edit || !initial.endDate}
                    clearLabel="Clear end"
                  />
                )}
              </Field>
            </div>
            <p className="text-muted-foreground text-xs">{edit ? EDIT_WINDOW_HINT : WINDOW_HINT}</p>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

/** `FxRatesSection`, scoped to the entity it writes (FX rates). */
export function FxRatesSection(props: FxRatesSectionProps) {
  return (
    <AccessScope entity={RBAC_ENTITY.FxRate}>
      <FxRatesSectionInner {...props} />
    </AccessScope>
  )
}
