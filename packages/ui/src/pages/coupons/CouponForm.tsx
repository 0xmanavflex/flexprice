import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type EditCoupon, editCouponSchema } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { provenance } from '@ui/provenance'

/**
 * Edit a coupon, on a full page.
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
  composes: ['ui/input', 'compositions/form-card', 'compositions/form-page'],
  note: 'RHF + the domain schema. A rename — the discount is immutable, shown as context.',
})

export interface CouponFormProps {
  defaultValue: EditCoupon
  /** Read-only context, so the person knows which coupon they are renaming. */
  summary?: { code: string; discount: string }
  onSubmit: (coupon: EditCoupon) => void
  onCancel: () => void
  /** Breadcrumb; the last crumb is the page itself. */
  trail: DetailCrumb[]
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

const FORM_ID = 'coupon-edit-form'

export function CouponForm({
  defaultValue,
  trail,
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
    <FormPage
      title={`Edit ${defaultValue.name || 'coupon'}`}
      description="Rename the coupon. Its discount, cadence and redemption window are fixed once created."
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'edit',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
        <FormCard>
          <FormRow label="Name" required error={errors.name?.message}>
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </FormRow>

          {summary ? (
            <FormRow
              label="Fixed terms"
              hint="The discount and how long it lasts are fixed once a coupon is created."
              align="start"
            >
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Code</dt>
                  <dd className="font-mono">{summary.code || '—'}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums">{summary.discount}</dd>
                </div>
              </dl>
            </FormRow>
          ) : null}
        </FormCard>
      </form>
    </FormPage>
  )
}
