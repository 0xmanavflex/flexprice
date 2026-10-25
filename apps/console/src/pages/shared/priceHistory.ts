import { chargeLineages, type Charge, type ChargeDetail } from '@fp/domain'
import { chargePriceLabel } from '@fp/ui/pages'

/**
 * A catalogue record's full price history as the charges table reads it: one
 * row per charge (its newest version), and per row the versions it has had.
 *
 * Earlier prices are not deleted when a charge is edited: the API ends them
 * and starts a new version: so they arrive here as ended prices and leave as
 * the History of the charge they belong to, inactive, with their dates.
 */
export function priceHistoryRows(prices: readonly Charge[]): {
  charges: Charge[]
  details: Map<string, ChargeDetail>
} {
  const details = new Map<string, ChargeDetail>()
  const charges = chargeLineages(prices).map((lineage) => {
    if (lineage.versions.length > 1) {
      details.set(lineage.current.id, {
        versions: lineage.versions.map((version) => ({
          id: version.id,
          price: chargePriceLabel(version),
          startDate: version.startDate,
          endDate: version.endDate,
          updatedAt: version.createdAt,
        })),
      })
    }
    return lineage.current
  })
  return { charges, details }
}
