import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type EditCoupon, editCouponSchema } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import { CouponPreviewCard, type CouponPreviewCardProps } from './CouponPreviewCard'
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
  composes: [
    'ui/input',
    'compositions/form-card',
    'compositions/form-page',
    'pages/coupon-preview-card',
  ],
  note: 'RHF + the domain schema. A rename — the discount is immutable, shown in the preview and as context.',
})

export interface CouponFormProps {
  defaultValue: EditCoupon
  /** Read-only context, so the person knows which coupon they are renaming. */
  summary?: { code: string; discount: string }
  /** The coupon's fixed terms, for the preview beside the form. The name follows the draft. */
  terms?: Omit<CouponPreviewCardProps, 'name'>
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
  terms,
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
      trail={trail}
      width="wide"
      preview={terms ? <CouponPreviewCard {...terms} name={form.watch('name')} /> : undefined}
      toolbar={{
        mode: 'edit',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
        <FormCard title="Coupon details">
          <FormRow
            label="Name"
            hint="Shown on invoices wherever the discount is applied."
            required
            error={errors.name?.message}
          >
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
