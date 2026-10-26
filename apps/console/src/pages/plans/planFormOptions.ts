import {
  DEFAULT_FEATURE_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  type Feature,
  FeatureType,
  PriceUnitStatus,
} from '@fp/domain'
import { useFeatures, usePriceGroupOptions, usePriceUnits } from '@fp/query'
import type { FeatureOption, MeterOption, PriceUnitOption } from '@fp/ui/pages'

/** A metered feature as the charge forms pick it; others have no meter to bill against. */
export function toMeterOptions(features: readonly Feature[]): MeterOption[] {
  return features
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
}

/**
 * The picker's meters plus any of `more` it lacks: the meters a plan's charges
 * reference, read by id, which can sit past the picker's first page.
 */
export function withMeters(meters: readonly MeterOption[], more: readonly Feature[]): MeterOption[] {
  const known = new Set(meters.map((meter) => meter.id))
  return [...meters, ...toMeterOptions(more).filter((meter) => !known.has(meter.id))]
}

/** The pickers the charge and entitlement forms need, read once from the catalogue. */
export function usePlanFormOptions() {
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100 })
  const priceUnits = usePriceUnits({ ...DEFAULT_PRICE_UNIT_QUERY, pageSize: 100 })
  const priceGroups = usePriceGroupOptions()

  const allFeatures = features.data?.features ?? []
  // A usage charge bills against a meter; only metered features have one.
  const meters = toMeterOptions(allFeatures)
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
