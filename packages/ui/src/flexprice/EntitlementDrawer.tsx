import { useMemo, useState } from 'react'
import {
  type CreateEntitlement,
  FeatureType,
  USAGE_RESET_PERIOD_LABEL,
  UsageResetPeriod,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Checkbox } from '@ui/primitives/checkbox'
import { Input } from '@ui/primitives/input'
import { Label } from '@ui/primitives/label'
import { Textarea } from '@ui/primitives/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/primitives/sheet'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Grant an entitlement, in a right-hand drawer.
 *
 * The feature chosen decides the whole form: a metered feature asks for a limit,
 * a reset period and whether going over is allowed; a static one a value; a
 * boolean one nothing but on/off; a config one a JSON blob. Choosing the feature
 * first and shaping the form to it is what stops the drawer showing a "usage
 * limit" field for a feature that has no usage.
 *
 * It emits a validated `CreateEntitlement`; the page bulk-creates it. Boolean
 * and static values are simple enough to hold in local state — this is a small,
 * single-purpose form, not the plan's whole editor.
 */
export const EntitlementDrawerProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet', 'ui/select', 'ui/checkbox', 'ui/input'],
  note: 'Add-entitlement drawer; fields follow the chosen feature’s type.',
})

/** A feature the drawer can grant. */
export interface FeatureOption {
  id: string
  name: string
  type: FeatureType
  /** Unit label for a metered feature, e.g. "calls" — shown beside the limit. */
  unit?: string
}

export interface EntitlementDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Features not already entitled — the drawer offers a choice from these. */
  features: FeatureOption[]
  onSubmit: (entitlement: CreateEntitlement) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function EntitlementDrawer({
  open,
  onOpenChange,
  features,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: EntitlementDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Add entitlement</SheetTitle>
          <SheetDescription>Grant a feature to everyone on this plan.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Keyed on `open` so the form starts blank each time the drawer opens. */}
          <EntitlementFields
            key={open ? 'open' : 'closed'}
            features={features}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface FieldsProps {
  features: FeatureOption[]
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (entitlement: CreateEntitlement) => void
  onCancel: () => void
}

function EntitlementFields({ features, isSubmitting, submitError, onSubmit, onCancel }: FieldsProps) {
  const [featureId, setFeatureId] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [unlimited, setUnlimited] = useState(false)
  const [resetPeriod, setResetPeriod] = useState<UsageResetPeriod>(UsageResetPeriod.Monthly)
  const [isSoftLimit, setIsSoftLimit] = useState(false)
  const [staticValue, setStaticValue] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [configText, setConfigText] = useState('{}')
  const [error, setError] = useState<string | null>(null)

  const feature = useMemo(() => features.find((f) => f.id === featureId), [features, featureId])

  const submit = () => {
    setError(null)
    if (!feature) {
      setError('Choose a feature')
      return
    }
    let draft: CreateEntitlement
    switch (feature.type) {
      case FeatureType.Metered:
        draft = {
          featureId: feature.id,
          featureType: FeatureType.Metered,
          usageLimit: unlimited ? null : Number(usageLimit || 0),
          usageResetPeriod: unlimited ? null : resetPeriod,
          isSoftLimit,
        }
        break
      case FeatureType.Static:
        draft = { featureId: feature.id, featureType: FeatureType.Static, staticValue }
        break
      case FeatureType.Boolean:
        draft = { featureId: feature.id, featureType: FeatureType.Boolean, isEnabled }
        break
      case FeatureType.Config: {
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(configText) as Record<string, unknown>
        } catch {
          setError('Configuration must be valid JSON')
          return
        }
        draft = { featureId: feature.id, featureType: FeatureType.Config, configValue: parsed }
        break
      }
    }
    onSubmit(draft)
  }

  return (
    <div className="flex min-h-full flex-col gap-5">
      <Field label="Feature" required>
        {({ id }) => (
          <Select
            value={featureId}
            onValueChange={(value) => setFeatureId(value ?? '')}
            disabled={isSubmitting}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder="Choose a feature" />
            </SelectTrigger>
            <SelectContent>
              {features.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Every feature is already granted
                </SelectItem>
              ) : (
                features.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </Field>

      {feature?.type === FeatureType.Metered ? (
        <>
          <Field label="Usage limit" {...(feature.unit ? { hint: `In ${feature.unit}.` } : {})}>
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                disabled={isSubmitting || unlimited}
                placeholder={unlimited ? 'Unlimited' : '0'}
                value={unlimited ? '' : usageLimit}
                onChange={(event) => setUsageLimit(event.target.value)}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={unlimited}
              onCheckedChange={(value) => setUnlimited(value === true)}
              disabled={isSubmitting}
            />
            Unlimited — no cap on usage
          </label>
          <Field label="Usage reset">
            {({ id }) => (
              <Select
                value={resetPeriod}
                onValueChange={(value) => setResetPeriod(value as UsageResetPeriod)}
                disabled={isSubmitting || unlimited}
              >
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UsageResetPeriod).map((period) => (
                    <SelectItem key={period} value={period}>
                      {USAGE_RESET_PERIOD_LABEL[period]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isSoftLimit}
              onCheckedChange={(value) => setIsSoftLimit(value === true)}
              disabled={isSubmitting}
            />
            Soft limit — allow usage past the limit
          </label>
        </>
      ) : null}

      {feature?.type === FeatureType.Static ? (
        <Field label="Value" required>
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting}
              placeholder="e.g. 25"
              value={staticValue}
              onChange={(event) => setStaticValue(event.target.value)}
              {...field}
            />
          )}
        </Field>
      ) : null}

      {feature?.type === FeatureType.Boolean ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={(value) => setIsEnabled(value === true)}
            disabled={isSubmitting}
          />
          Enabled on this plan
        </label>
      ) : null}

      {feature?.type === FeatureType.Config ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ent-config">Configuration (JSON)</Label>
          <Textarea
            id="ent-config"
            rows={5}
            className="font-mono text-xs"
            disabled={isSubmitting}
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
          />
        </div>
      ) : null}

      {error || submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? submitError}
        </p>
      ) : null}

      <div className="mt-auto flex gap-2 border-t pt-4">
        <Button type="button" disabled={isSubmitting || !feature} onClick={submit}>
          {isSubmitting ? 'Adding…' : 'Add entitlement'}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
