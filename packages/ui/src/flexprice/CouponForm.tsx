import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type EditCoupon, editCouponSchema } from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Edit a coupon.
 *
 * A coupon's editor is a rename. The API's `UpdateCouponRequest` accepts only
 * the name (and metadata) — a coupon already redeemed against live
 * subscriptions cannot change what it discounts underneath them — so the type,
 * code and discount are shown read-only as context and only the name is a
 * control. Presentational, like every form here: it emits a validated
 * `EditCoupon` and never imports `@fp/query`.
 */
export const CouponFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/label'],
  note: 'RHF + the domain schema. A rename — the discount is immutable, shown as context.',
})

export interface CouponFormProps {
  defaultValue: EditCoupon
  /** Read-only context, so the person knows which coupon they are renaming. */
  summary?: { code: string; discount: string }
  onSubmit: (coupon: EditCoupon) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

export function CouponForm({
  defaultValue,
  summary,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: CouponFormProps) {
  const form = useForm<EditCoupon>({
    resolver: standardSchemaResolver(editCouponSchema) as Resolver<EditCoupon>,
    defaultValues: defaultValue,
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex min-h-full flex-col gap-6"
    >
      <Field label="Name" required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>

      {summary ? (
        <dl className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="font-mono">{summary.code || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="tabular-nums">{summary.discount}</dd>
          </div>
          <p className="text-xs text-muted-foreground">
            The discount and how long it lasts are fixed once a coupon is created.
          </p>
        </dl>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
