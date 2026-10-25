import { useState } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionSelect, type Option } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * A coupon on one charge of a new contract, opened from that charge's menu or
 * its coupon chip. One coupon per charge: choosing another replaces it, and
 * Remove coupon takes it off. A discount on the whole contract is chosen on
 * the Discount card instead, and the dialog says so.
 */
export const ChargeCouponDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog', 'compositions/detail-kit', 'compositions/option-select'],
  note: 'The contract wizard’s per-charge coupon dialog (reference CouponDialog).',
})

/** A coupon to choose: `discount` ("20%", "$50") is shown beside its name. */
export interface ChargeCouponOption extends Option {
  discount?: string | undefined
}

/** "Launch · 20% off", or the name alone when the discount is not known. */
export function couponOptionLabel(coupon: ChargeCouponOption): string {
  return coupon.discount ? `${coupon.label} · ${coupon.discount} off` : coupon.label
}

export interface ChargeCouponDialogProps {
  /** The charge the coupon is for; the dialog is closed while this is null. */
  charge: { priceId: string; name: string } | null
  /** The coupon already on the charge, if any. */
  couponId: string | undefined
  coupons: readonly ChargeCouponOption[]
  onClose: () => void
  /** The chosen coupon's id, or null to take the coupon off. */
  onSave: (couponId: string | null) => void
}

export function ChargeCouponDialog({
  charge,
  couponId,
  coupons,
  onClose,
  onSave,
}: ChargeCouponDialogProps) {
  return (
    <FormDialog
      open={charge !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={charge ? `${couponId ? 'Change' : 'Apply'} coupon · ${charge.name}` : ''}
    >
      {charge ? (
        <CouponBody
          key={charge.priceId}
          couponId={couponId}
          coupons={coupons}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </FormDialog>
  )
}

function CouponBody({
  couponId,
  coupons,
  onClose,
  onSave,
}: Omit<ChargeCouponDialogProps, 'charge'>) {
  const [chosen, setChosen] = useState(couponId ?? '')
  // Apply coupon is offered on every charge, so the catalogue can be empty:
  // say where coupons come from instead of an empty list.
  if (coupons.length === 0 && !couponId) {
    return (
      <Composer submitLabel="Apply coupon" onSubmit={() => undefined} onCancel={onClose} disabled>
        <p className="text-muted-foreground -mt-2 text-sm">
          No coupons yet. Create one under Product catalog → Coupons, then apply it here.
        </p>
      </Composer>
    )
  }
  return (
    <Composer
      submitLabel={couponId ? 'Save coupon' : 'Apply coupon'}
      onSubmit={() => (chosen ? onSave(chosen) : undefined)}
      onCancel={onClose}
      disabled={!chosen}
      secondary={
        couponId ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive h-8"
            onClick={() => onSave(null)}
          >
            Remove coupon
          </Button>
        ) : null
      }
    >
      <p className="text-muted-foreground -mt-2 text-sm">
        Applies to this charge only. A discount on the whole contract is chosen under Discount.
      </p>
      <Field label="Coupon">
        {({ id, 'aria-describedby': describedBy }) => (
          <OptionSelect
            id={id}
            aria-describedby={describedBy}
            value={chosen || undefined}
            onValueChange={setChosen}
            placeholder="Choose a coupon…"
            options={coupons.map((coupon) => ({
              value: coupon.value,
              label: couponOptionLabel(coupon),
            }))}
          />
        )}
      </Field>
    </Composer>
  )
}
