import { useState } from 'react'
import { chargeLineages, type Charge, type ChargeDetail, type ChargeHistory } from '@fp/domain'
import { usePlanPriceVersions } from '@fp/query'
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

/**
 * The open plan charge's versions, read from `GET /prices/{id}/history` as its
 * sheet opens. Spread `table` onto the charges table; `versions` are the
 * prices read, for a revert to find the one picked.
 */
export function usePlanChargeHistory(): {
  table: { onOpenCharge: (charge: Charge | null) => void; history?: ChargeHistory }
  versions: readonly Charge[]
} {
  const [open, setOpen] = useState<Charge | null>(null)
  const read = usePlanPriceVersions(open?.id ?? '')
  const history: ChargeHistory | undefined = open
    ? {
        ...(read.data
          ? {
              versions: read.data.map((version) => ({
                id: version.id,
                price: chargePriceLabel(version),
                startDate: version.startDate,
                endDate: version.endDate,
                updatedAt: version.createdAt,
              })),
            }
          : {}),
        isLoading: read.isLoading,
        error: read.error ? 'The history could not be loaded.' : null,
        onRetry: () => void read.refetch(),
      }
    : undefined
  return {
    table: { onOpenCharge: setOpen, ...(history ? { history } : {}) },
    versions: read.data ?? [],
  }
}
