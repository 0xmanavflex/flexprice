import {
  DEFAULT_FEATURE_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  FeatureType,
  PriceUnitStatus,
} from '@fp/domain'
import { useFeatures, usePriceGroupOptions, usePriceUnits } from '@fp/query'
import type { FeatureOption, MeterOption, PriceUnitOption } from '@fp/ui/pages'

/** The pickers the charge and entitlement forms need, read once from the catalogue. */
export function usePlanFormOptions() {
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100 })
  const priceUnits = usePriceUnits({ ...DEFAULT_PRICE_UNIT_QUERY, pageSize: 100 })
  const priceGroups = usePriceGroupOptions()

  const allFeatures = features.data?.features ?? []
  // A usage charge bills against a meter; only metered features have one.
  const meters: MeterOption[] = allFeatures
    .filter((f) => f.type === FeatureType.Metered && f.meterId)
    .map((f) => ({
      id: f.meterId as string,
      name: f.name,
      ...(f.unitSingular ? { unit: f.unitSingular } : {}),
      // Both decide whether a usage window may be set on a charge, and the
      // charge form leaves the field out rather than guessing when they are
      // absent: see `MeterOption`.
      ...(f.aggregationType ? { aggregationType: f.aggregationType } : {}),
      ...(f.meterBucketSize ? { bucketSize: f.meterBucketSize } : {}),
    }))
  const units: PriceUnitOption[] = (priceUnits.data?.priceUnits ?? [])
    .filter((unit) => unit.status === PriceUnitStatus.Published)
    .map((unit) => ({ code: unit.code, name: unit.name, baseCurrency: unit.baseCurrency }))
  const featureOptions: FeatureOption[] = allFeatures.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    ...(f.type === FeatureType.Metered && f.unitPlural ? { unit: f.unitPlural } : {}),
  }))

  return { meters, units, priceGroups, featureOptions, allFeatures }
}
