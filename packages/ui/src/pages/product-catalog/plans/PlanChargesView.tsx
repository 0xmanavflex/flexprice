import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope } from '@ui/compositions/access/Access'
import { BillingModel, type Charge, type ChargeDetail, chargeToDraft } from '@fp/domain'
import { ChargeTable } from '../charges/ChargeTable'
import { chargeLabel, pricingSummary } from './PlanPreviewCard'

export interface PlanChargesViewProps {
  charges: Charge[]
  onAdd: () => void
  onEdit: (charge: Charge) => void
  onTerminate: (charge: Charge) => void
  readOnly?: boolean
  /** The plan's prices are still being fetched: skeleton rows, no add action. */
  loading?: boolean
  /** The fetch failed. Shown in place of the list: never as "No charges yet". */
  error?: boolean
  /** Re-runs the fetch; the error state's "Try again". */
  onRetry?: () => void
  /** Singular unit of a meter ("call"), for "per call" wording. */
  meterUnit?: (meterId: string) => string | undefined
  /** Per charge: what else is known, such as its earlier price versions. */
  details?: ReadonlyMap<string, ChargeDetail> | undefined
  /** Brings back a charge's previous price version. */
  onRevert?: ((charge: Charge, versionId: string) => Promise<unknown>) | undefined
}

/** Plan actions and pricing labels composed over the shared charges table and sheet. */
function PlanChargesViewInner({
  charges,
  onAdd,
  onEdit,
  onTerminate,
  readOnly,
  loading,
  error,
  onRetry,
  meterUnit,
  details,
  onRevert,
}: PlanChargesViewProps) {
  const meterName = (id: string) => charges.find((charge) => charge.meterId === id)?.meterName ?? id
  return (
    <ChargeTable
      charges={
        loading || error
          ? []
          : charges.map((charge) => ({
              ...charge,
              displayName: chargeLabel(chargeToDraft(charge), meterName),
            }))
      }
      layout="narrow"
      // When each charge is billed, on screen; "In effect" stays in the column menu here.
      showDates
      {...(details ? { details } : {})}
      {...(onRevert && !readOnly ? { onRevert } : {})}
      isLoading={loading ?? false}
      error={error ? 'Charges could not be loaded' : null}
      onRetry={onRetry}
      hideRowActions={readOnly ?? false}
      {...(!readOnly ? { onAdd, onEdit, onTerminate } : {})}
      addLabel="Add charge"
      priceLabel={(charge) =>
        charge.displayAmount && charge.billingModel === BillingModel.FlatFee
          ? charge.displayAmount
          : pricingSummary(
              chargeToDraft(charge),
              (charge.currency || 'usd').toUpperCase(),
              undefined,
              charge.meterId ? meterUnit?.(charge.meterId) : undefined,
            )
      }
    />
  )
}

/** `PlanChargesView`, scoped to the entity it writes (Price). */
export function PlanChargesView(props: Parameters<typeof PlanChargesViewInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.Price}>
      <PlanChargesViewInner {...props} />
    </AccessScope>
  )
}
