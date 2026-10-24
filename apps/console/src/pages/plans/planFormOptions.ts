import {
  DEFAULT_FEATURE_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  FeatureStatus,
  FeatureType,
  PriceUnitStatus,
} from '@fp/domain'
import { useFeatures, usePriceGroupOptions, usePriceUnits } from '@fp/query'
import type { FeatureOption, MeterOption, PriceUnitOption } from '@fp/ui/pages'

/** The pickers the charge and entitlement forms need, read once from the catalogue. */
export function usePlanFormOptions() {
  // Every status: these options also name the meters and features of charges
  // and entitlements already saved, and an archived feature's must still resolve.
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100, filters: [] })
  const priceUnits = usePriceUnits({ ...DEFAULT_PRICE_UNIT_QUERY, pageSize: 100 })
  const priceGroups = usePriceGroupOptions()

  const allFeatures = features.data?.features ?? []
  // A usage charge bills against a meter; only metered features have one.
  const meters: MeterOption[] = allFeatures
    .filter((f) => f.type === FeatureType.Metered && f.meterId)
    .map((f) => ({
      id: f.meterId as string,
      name: f.status === FeatureStatus.Archived ? `${f.name} (archived)` : f.name,
      ...(f.unitSingular ? { unit: f.unitSingular } : {}),
      // Both decide whether a usage window may be set on a charge, and the
      // charge form leaves the field out rather than guessing when they are
      // absent — see `MeterOption`.
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
