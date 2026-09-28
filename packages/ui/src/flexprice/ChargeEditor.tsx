import { useMemo, useState, type ReactNode } from 'react'
import {
  BILLING_MODEL_LABEL,
  BillingModel,
  type CreateCharge,
  type PriceEntityType,
  PriceType,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ui/primitives/card'
import { Badge } from '@ui/components/reui/badge'
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
} from '@ui/components/reui/stepper'
import { ArrowRightIcon, GaugeIcon, PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from 'lucide-react'
import { EmptyState } from '@ui/compositions/EmptyState'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ChargeForm, type MeterOption } from './ChargeForm'

/**
 * The charges builder — a standalone, stepped charge flow.
 *
 * A charge is added the same way anywhere it is added, so this is a self-contained
 * builder rather than a page-specific two-pane surface: **pick a type → configure
 * it → review**, inside one Card with a stepper for the shape of the flow. The
 * live customer-facing preview it used to carry now lives on the plan detail page,
 * where the plan's pricing belongs; here the editor stays focused on building the
 * charges themselves, so it drops into any flow that needs new charges.
 *
 * It holds the working set as local state and emits a validated `CreateCharge[]`
 * on save; the mapping to prices and the bulk request belong to `@fp/query`, so
 * this stays presentational and testable without a network.
 */
export const ChargeEditorProvenance = provenance({
  source: 'composition',
  composes: ['@reui/stepper', 'ui/card', 'ui/button', '@reui/badge'],
  note: 'Standalone stepped charge builder: pick a type, configure via ChargeForm, review and save.',
})

/** A charge in the working set, with a stable key for editing and removal. */
interface DraftCharge {
  key: string
  value: CreateCharge
  /** New charges are removed on cancel; saved ones revert. */
  isNew: boolean
}

export interface ChargeEditorProps {
  planName: string
  entityType: PriceEntityType
  initialCharges?: CreateCharge[]
  meters?: MeterOption[]
  currencies?: string[]
  onSave: (charges: CreateCharge[]) => void
  onCancel?: () => void
  isSaving?: boolean
  saveError?: string | null
  locale?: string
}

/** The three phases of building a charge, in order. */
const STEPS = [
  { value: 1, title: 'Type', description: 'Pick what kind of charge to add.' },
  { value: 2, title: 'Configure', description: 'Set the price and how it bills.' },
  {
    value: 3,
    title: 'Review',
    description: 'Check the charges, then save them to the plan.',
  },
] as const

let keySeq = 0
const nextKey = () => `charge_${keySeq++}`

/** A one-line summary of how a saved charge prices, for its review row. */
function summary(charge: CreateCharge): string {
  const model = BILLING_MODEL_LABEL[charge.billingModel]
  switch (charge.billingModel) {
    case BillingModel.FlatFee:
      return `${model} · ${charge.currency} ${charge.amount || '0'}`
    case BillingModel.Package:
      return `${model} · ${charge.currency} ${charge.amount || '0'} per ${charge.divideBy}`
    case BillingModel.Tiered:
      return `${model} · ${charge.tiers.length} tier${charge.tiers.length === 1 ? '' : 's'}`
  }
}

export function ChargeEditor({
  planName,
  initialCharges = [],
  meters = [],
  currencies,
  onSave,
  onCancel,
  isSaving = false,
  saveError = null,
}: ChargeEditorProps) {
  const [charges, setCharges] = useState<DraftCharge[]>(() =>
    initialCharges.map((value) => ({ key: nextKey(), value, isNew: false })),
  )
  // A plan opened with charges already lands on Review; an empty one starts by
  // choosing a type.
  const [step, setStep] = useState<number>(initialCharges.length > 0 ? 3 : 1)
  const [selectedType, setSelectedType] = useState<PriceType>(PriceType.Fixed)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const meterName = useMemo(() => {
    const byId = new Map(meters.map((m) => [m.id, m.name]))
    return (id: string) => byId.get(id) ?? id
  }, [meters])

  const currentStep = STEPS[step - 1] ?? STEPS[0]
  const editingCharge = editingKey ? charges.find((c) => c.key === editingKey) : undefined

  /** Start a fresh charge of the chosen type. */
  const goConfigureNew = () => {
    setEditingKey(null)
    setStep(2)
  }

  /** Re-open a committed charge for editing. */
  const goConfigureEdit = (charge: DraftCharge) => {
    setSelectedType(charge.value.type)
    setEditingKey(charge.key)
    setStep(2)
  }

  /** Back to the type picker to add another charge. */
  const goType = () => {
    setEditingKey(null)
    setStep(1)
  }

  // A submit either updates the charge being edited or appends a new one, then
  // returns to the review so the working set is always what will be saved.
  const commit = (value: CreateCharge) => {
    setCharges((prev) =>
      editingKey
        ? prev.map((c) => (c.key === editingKey ? { ...c, value, isNew: false } : c))
        : [...prev, { key: nextKey(), value, isNew: false }],
    )
    setEditingKey(null)
    setStep(3)
  }

  const cancelConfigure = () => {
    // Editing returns to review; a new-but-abandoned charge returns to review if
    // the plan already has charges, otherwise back to the type picker.
    setEditingKey(null)
    setStep(editingKey || charges.length > 0 ? 3 : 1)
  }

  const remove = (key: string) => {
    setCharges((prev) => prev.filter((c) => c.key !== key))
    if (editingKey === key) setEditingKey(null)
  }

  const canSave = charges.length > 0

  return (
    <div className="w-full max-w-3xl">
      <Card className="w-full gap-0 p-0">
        <Stepper value={step} onValueChange={setStep}>
          <CardHeader className="gap-x-4 gap-y-1 border-b px-5 py-4">
            <CardTitle>Add charges</CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
            <CardAction className="self-center">
              <Badge variant="secondary">
                {charges.length} charge{charges.length === 1 ? '' : 's'}
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-6 px-5 py-6">
            <div className="overflow-x-auto overflow-y-hidden py-2">
              <StepperNav aria-label="Charge builder progress" className="items-start">
                {STEPS.map((s, index) => (
                  <StepperItem
                    key={s.value}
                    step={s.value}
                    className="relative min-w-0 flex-1 overflow-visible"
                  >
                    <div className="flex w-full min-w-0 flex-col items-center gap-2 px-0 text-center">
                      <StepperIndicator className="size-6">{index + 1}</StepperIndicator>
                      <StepperTitle className="text-xs leading-tight sm:text-sm">
                        {s.title}
                      </StepperTitle>
                    </div>
                    {index < STEPS.length - 1 ? (
                      <StepperSeparator className="group-data-[state=completed]/step:bg-primary absolute top-3 left-[calc(50%+1.125rem)] m-0 w-[calc(100%-2.25rem)] flex-none" />
                    ) : null}
                  </StepperItem>
                ))}
              </StepperNav>
            </div>

            <StepperPanel>
              {/* Step 1 — pick a charge type. */}
              <StepperContent value={1}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TypeCard
                    active={selectedType === PriceType.Fixed}
                    icon={<RepeatIcon aria-hidden className="size-4" />}
                    title="Fixed charge"
                    description="A recurring base fee — flat, per-package, or tiered — billed every period."
                    onClick={() => setSelectedType(PriceType.Fixed)}
                  />
                  <TypeCard
                    active={selectedType === PriceType.Usage}
                    icon={<GaugeIcon aria-hidden className="size-4" />}
                    title="Usage charge"
                    description="Bill on what a metered feature consumes, settled in arrears each period."
                    onClick={() => setSelectedType(PriceType.Usage)}
                  />
                </div>
              </StepperContent>

              {/* Step 2 — configure the selected charge. */}
              <StepperContent value={2}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <ChargeTypeBadge type={selectedType} />
                    <span className="text-sm font-medium">
                      {editingCharge ? 'Edit charge' : 'New charge'}
                    </span>
                  </div>
                  <ChargeForm
                    key={editingKey ?? `new-${selectedType}`}
                    type={selectedType}
                    {...(editingCharge ? { defaultValue: editingCharge.value } : {})}
                    {...(meters.length ? { meters } : {})}
                    {...(currencies ? { currencies } : {})}
                    isSubmitting={isSaving}
                    onSubmit={commit}
                    onCancel={cancelConfigure}
                  />
                </div>
              </StepperContent>

              {/* Step 3 — review the working set and save. */}
              <StepperContent value={3}>
                {charges.length === 0 ? (
                  <EmptyState
                    size="inline"
                    title="No charges yet"
                    description="A plan bills nothing until it has a charge. Add a fixed charge for a recurring base, or a usage charge to bill on consumption."
                    action={
                      <Button type="button" size="sm" onClick={goType}>
                        <PlusIcon aria-hidden className="size-4" />
                        Add a charge
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="divide-y rounded-lg border">
                      {charges.map((charge) => (
                        <div
                          key={charge.key}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <ChargeTypeBadge type={charge.value.type} />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">
                                {charge.value.displayName ||
                                  (charge.value.type === PriceType.Usage
                                    ? meterName(charge.value.meterId ?? '')
                                    : 'Base fee')}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {summary(charge.value)}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Edit charge"
                              disabled={isSaving}
                              onClick={() => goConfigureEdit(charge)}
                            >
                              <PencilIcon aria-hidden className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove charge"
                              disabled={isSaving}
                              onClick={() => remove(charge.key)}
                            >
                              <Trash2Icon aria-hidden className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      disabled={isSaving}
                      onClick={goType}
                    >
                      <PlusIcon aria-hidden className="size-4" />
                      Add another charge
                    </Button>

                    {saveError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {saveError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {charges.length} charge{charges.length === 1 ? '' : 's'} will be added to{' '}
                        {planName || 'this plan'}.
                      </p>
                    )}
                  </div>
                )}
              </StepperContent>
            </StepperPanel>
          </CardContent>

          {/* The footer belongs to the type and review steps; the configure step
              is driven by the charge form's own submit and cancel. */}
          {step === 1 ? (
            <CardFooter className="justify-between gap-3 px-5 py-4">
              {onCancel ? (
                <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <span aria-hidden />
              )}
              <Button type="button" onClick={goConfigureNew}>
                Continue
                <ArrowRightIcon aria-hidden className="size-4" />
              </Button>
            </CardFooter>
          ) : null}

          {step === 3 ? (
            <CardFooter className="justify-between gap-3 px-5 py-4">
              {onCancel ? (
                <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <span aria-hidden />
              )}
              <Button
                type="button"
                disabled={!canSave || isSaving}
                onClick={() => onSave(charges.map((c) => c.value))}
              >
                {isSaving ? 'Saving…' : 'Save charges'}
              </Button>
            </CardFooter>
          ) : null}
        </Stepper>
      </Card>
    </div>
  )
}

/** A selectable charge-type card on the first step. */
function TypeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-colors',
        'hover:border-primary/50 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

function ChargeTypeBadge({ type }: { type: PriceType }) {
  return type === PriceType.Usage ? (
    <Badge variant="secondary">
      <GaugeIcon aria-hidden className="size-3" />
      Usage
    </Badge>
  ) : (
    <Badge variant="secondary">
      <RepeatIcon aria-hidden className="size-3" />
      Fixed
    </Badge>
  )
}
