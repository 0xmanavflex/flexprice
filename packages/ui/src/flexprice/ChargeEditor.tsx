import { useMemo, useState } from 'react'
import {
  BILLING_MODEL_LABEL,
  BillingModel,
  type CreateCharge,
  type PriceEntityType,
  PriceType,
  emptyCharge,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Card, CardContent } from '@ui/primitives/card'
import { Badge } from '@ui/components/reui/badge'
import { GaugeIcon, PencilIcon, RepeatIcon, Trash2Icon } from 'lucide-react'
import { EmptyState } from '@ui/compositions/EmptyState'
import { provenance } from '@ui/provenance'
import { ChargeForm, type MeterOption } from './ChargeForm'
import { PlanPreviewCard } from './PlanPreviewCard'

/**
 * The charges builder — the signature two-pane, live-preview surface.
 *
 * Left, the charges being assembled: a card per charge, each editable in place,
 * with a fixed or usage form behind it. Right, a **sticky live preview** — the
 * plan as a customer would see it, with an example bill — that updates the
 * moment a charge is added, edited or removed. It is the same `PlanPreviewCard`
 * the plan list's cards view uses, driven here from the draft charges.
 *
 * It holds the working set as local state and emits a validated `CreateCharge[]`
 * on save; the mapping to prices and the bulk request belong to `@fp/query`, so
 * this stays presentational and testable without a network.
 */
export const ChargeEditorProvenance = provenance({
  source: 'composition',
  composes: ['ui/card', 'ui/button', '@reui/badge'],
  note: 'Two-pane charges builder: editable charge cards left, sticky live preview right.',
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

let keySeq = 0
const nextKey = () => `charge_${keySeq++}`

/** A one-line summary of how a saved charge prices, for its card. */
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
  entityType: _entityType,
  initialCharges = [],
  meters = [],
  currencies,
  onSave,
  onCancel,
  isSaving = false,
  saveError = null,
  locale,
}: ChargeEditorProps) {
  const [charges, setCharges] = useState<DraftCharge[]>(() =>
    initialCharges.map((value) => ({ key: nextKey(), value, isNew: false })),
  )
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const meterName = useMemo(() => {
    const byId = new Map(meters.map((m) => [m.id, m.name]))
    return (id: string) => byId.get(id) ?? id
  }, [meters])

  const startAdd = (type: PriceType) => {
    const key = nextKey()
    setCharges((prev) => [
      ...prev,
      { key, value: emptyCharge(type, BillingModel.FlatFee), isNew: true },
    ])
    setEditingKey(key)
  }

  const commit = (key: string, value: CreateCharge) => {
    setCharges((prev) =>
      prev.map((charge) => (charge.key === key ? { ...charge, value, isNew: false } : charge)),
    )
    setEditingKey(null)
  }

  const cancelEdit = (key: string, isNew: boolean) => {
    if (isNew) setCharges((prev) => prev.filter((charge) => charge.key !== key))
    setEditingKey(null)
  }

  const remove = (key: string) => {
    setCharges((prev) => prev.filter((charge) => charge.key !== key))
    if (editingKey === key) setEditingKey(null)
  }

  // The preview reflects the committed set: a charge counts once it is added or
  // updated, so the example bill is always of charges that actually validate.
  const previewCharges = charges.map((c) => c.value)
  const canSave = charges.length > 0 && editingKey === null

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* LEFT — the charges being assembled. */}
      <div className="flex flex-col gap-4">
        {charges.length === 0 ? (
          <EmptyState
            size="inline"
            title="No charges yet"
            description="A plan bills nothing until it has a charge. Add a fixed charge for a recurring base, or a usage charge to bill on consumption."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {charges.map((charge) =>
              editingKey === charge.key ? (
                <Card key={charge.key} className="border-primary/40">
                  <CardContent className="pt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <ChargeTypeBadge type={charge.value.type} />
                      <span className="text-sm font-medium">
                        {charge.isNew ? 'New charge' : 'Edit charge'}
                      </span>
                    </div>
                    <ChargeForm
                      type={charge.value.type}
                      // A new card opens blank (so its button reads "Add charge");
                      // an existing one is seeded, so edits start from its values.
                      {...(charge.isNew ? {} : { defaultValue: charge.value })}
                      {...(meters.length ? { meters } : {})}
                      {...(currencies ? { currencies } : {})}
                      isSubmitting={isSaving}
                      onSubmit={(value) => commit(charge.key, value)}
                      onCancel={() => cancelEdit(charge.key, charge.isNew)}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card key={charge.key}>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
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
                        disabled={isSaving || editingKey !== null}
                        onClick={() => setEditingKey(charge.key)}
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
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}

        {/* Add controls, always available unless a card is mid-edit. */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving || editingKey !== null}
            onClick={() => startAdd(PriceType.Fixed)}
          >
            <RepeatIcon aria-hidden className="size-4" />
            Add fixed charge
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving || editingKey !== null}
            onClick={() => startAdd(PriceType.Usage)}
          >
            <GaugeIcon aria-hidden className="size-4" />
            Add usage charge
          </Button>
        </div>

        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="flex gap-2 border-t pt-4">
          <Button
            type="button"
            disabled={!canSave || isSaving}
            onClick={() => onSave(charges.map((c) => c.value))}
          >
            {isSaving ? 'Saving…' : 'Save charges'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
        {editingKey !== null ? (
          <p className="text-xs text-muted-foreground">
            Finish the charge you are editing to save the plan.
          </p>
        ) : null}
      </div>

      {/* RIGHT — the sticky live preview. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <PlanPreviewCard
          name={planName}
          charges={previewCharges}
          meterLabel={meterName}
          {...(locale ? { locale } : {})}
        />
      </div>
    </div>
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
