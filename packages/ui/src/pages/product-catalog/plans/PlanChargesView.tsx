import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope } from '@ui/compositions/access/Access'
import {
  BillingModel,
  type Charge,
  type ChargeDetail,
  type ChargeHistory,
  chargeToDraft,
} from '@fp/domain'
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
  /** Which charge's sheet is open, so the page can read its history. */
  onOpenCharge?: ((charge: Charge | null) => void) | undefined
  /** The open charge's versions from `GET /prices/{id}/history`. */
  history?: ChargeHistory | undefined
  /** The empty state's line, naming what the charges belong to. */
  emptyDescription?: string | undefined
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
  onOpenCharge,
  history,
  emptyDescription,
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
      // When each charge is billed and when it is in effect, on screen.
      showDates
      {...(details ? { details } : {})}
      {...(onRevert && !readOnly ? { onRevert } : {})}
      {...(onOpenCharge ? { onOpenCharge } : {})}
      {...(history ? { history } : {})}
      isLoading={loading ?? false}
      error={error ? 'Charges could not be loaded' : null}
      onRetry={onRetry}
      hideRowActions={readOnly ?? false}
      {...(!readOnly ? { onAdd, onEdit, onTerminate } : {})}
      addLabel="Add charge"
      {...(emptyDescription ? { emptyDescription } : {})}
      priceLabel={(charge) =>
        charge.displayAmount && charge.billingModel === BillingModel.FlatFee
          ? charge.displayAmount
          : pricingSummary(
              chargeToDraft(charge),
              (charge.currency || 'usd').toUpperCase(),
              undefined,
              charge.meterId ? meterUnit?.(charge.meterId) : undefined,
              // The table puts the tier count on its own grey line under the price.
              { tierCount: false },
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
