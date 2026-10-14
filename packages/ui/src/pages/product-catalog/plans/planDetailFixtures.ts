import {
  BillingModel,
  BillingPeriod,
  type Charge,
  type CreditGrant,
  CreditGrantCadence,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  CreditGrantScope,
  type Entitlement,
  EntitlementEntityType,
  FeatureType,
  InvoiceCadence,
  PriceEntityType,
  PriceType,
  RoundType,
  TierMode,
  UsageResetPeriod,
} from '@fp/domain'

/** Charges, entitlements and grants of a saved plan as plain domain values, built from counts. */

const FIXED_NAMES = ['Platform base', 'Seat licence', 'Support add-on', 'Onboarding', 'SSO']
const METERS = [
  { id: 'meter_api', name: 'API calls', unit: 'call' },
  { id: 'meter_tokens', name: 'Tokens processed', unit: 'token' },
  { id: 'meter_storage', name: 'Storage (GB)', unit: 'GB' },
]

export const fixtureMeters = METERS.map(({ id, name, unit }) => ({ id, name, unit }))

export const meterUnitOf = (meterId: string): string | undefined =>
  METERS.find((m) => m.id === meterId)?.unit

export interface MakeChargeOptions {
  type: PriceType
  billingModel?: BillingModel
  billingPeriod?: BillingPeriod
  currency?: string
}

export function makeCharge(index: number, options: MakeChargeOptions): Charge {
  const { type, billingPeriod = BillingPeriod.Monthly, currency = 'usd' } = options
  const isUsage = type === PriceType.Usage
  const billingModel = isUsage
    ? (options.billingModel ?? BillingModel.Tiered)
    : BillingModel.FlatFee
  const meter = METERS[index % METERS.length]!
  const amount = String(9 + ((index * 20) % 90))
  return {
    id: `price_${type.toLowerCase()}_${index}`,
    type,
    billingModel,
    amount: billingModel === BillingModel.Tiered ? '' : `${amount}.00`,
    displayAmount: billingModel === BillingModel.FlatFee ? `$${amount}.00` : '',
    currency,
    billingPeriod,
    billingPeriodCount: 1,
    invoiceCadence: isUsage ? InvoiceCadence.Arrear : InvoiceCadence.Advance,
    billingCadence: 'RECURRING',
    tierMode: billingModel === BillingModel.Tiered ? TierMode.Volume : null,
    tiers:
      billingModel === BillingModel.Tiered
        ? [
            { upTo: 10_000, unitAmount: '0.002', flatAmount: '0' },
            { upTo: null, unitAmount: '0.001' },
          ]
        : [],
    transformQuantity:
      billingModel === BillingModel.Package ? { divideBy: 1000, round: RoundType.Up } : null,
    bucketSize: null,
    meterId: isUsage ? meter.id : null,
    meterName: isUsage ? meter.name : null,
    entityType: PriceEntityType.Plan,
    entityId: 'plan_02',
    lookupKey: `${type.toLowerCase()}_${index}`,
    description: '',
    displayName: isUsage
      ? ''
      : `${FIXED_NAMES[index % FIXED_NAMES.length]}${index >= FIXED_NAMES.length ? ` ${index}` : ''}`,
    createdAt: new Date('2026-01-10T00:00:00Z'),
  }
}

export function makeCharges(
  fixed: number,
  usage: number,
  options: Omit<MakeChargeOptions, 'type'> = {},
): Charge[] {
  return [
    ...Array.from({ length: fixed }, (_, i) =>
      makeCharge(i, { ...options, type: PriceType.Fixed }),
    ),
    ...Array.from({ length: usage }, (_, i) =>
      makeCharge(i, { ...options, type: PriceType.Usage }),
    ),
  ]
}

const FEATURE_NAMES = [
  'AI Tokens',
  'SSO',
  'Seats',
  'Custom domain',
  'Video minutes',
  'Audit log',
  'Compute minutes',
  'Support tier',
]

export type EntitlementMix = FeatureType | 'mixed'

export interface MakeEntitlementsOptions {
  featureType?: EntitlementMix
  /** Every n-th metered entitlement is unlimited. 0 means none. */
  unlimitedEvery?: number
  entityId?: string
}

export function makeEntitlement(
  index: number,
  featureType: FeatureType,
  options: MakeEntitlementsOptions = {},
): Entitlement {
  const { unlimitedEvery = 4, entityId = 'plan_02' } = options
  const unlimited = unlimitedEvery > 0 && index % unlimitedEvery === unlimitedEvery - 1
  return {
    id: `ent_${index}`,
    featureId: `feat_${index}`,
    featureName: `${FEATURE_NAMES[index % FEATURE_NAMES.length]}${index >= FEATURE_NAMES.length ? ` ${index}` : ''}`,
    featureType,
    entityType: EntitlementEntityType.Plan,
    entityId,
    usageLimit:
      featureType === FeatureType.Metered && !unlimited ? 10_000 * (1 + (index % 5)) : null,
    usageResetPeriod: featureType === FeatureType.Metered ? UsageResetPeriod.Monthly : null,
    isSoftLimit: false,
    staticValue: featureType === FeatureType.Static ? `${5 + index}` : null,
    isEnabled: featureType === FeatureType.Boolean ? index % 2 === 0 : null,
    configValue: featureType === FeatureType.Config ? { tier: 'gold' } : null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
  }
}

const MIXED: FeatureType[] = [
  FeatureType.Metered,
  FeatureType.Boolean,
  FeatureType.Static,
  FeatureType.Metered,
  FeatureType.Config,
]

export function makeEntitlements(
  count: number,
  options: MakeEntitlementsOptions = {},
): Entitlement[] {
  const { featureType = 'mixed' } = options
  return Array.from({ length: count }, (_, i) =>
    makeEntitlement(i, featureType === 'mixed' ? MIXED[i % MIXED.length]! : featureType, options),
  )
}

export function makeGrants(count: number): CreditGrant[] {
  return Array.from({ length: count }, (_, i): CreditGrant => {
    const recurring = i % 2 === 1
    return {
      id: `cg_${i}`,
      name: recurring ? `Monthly included credits ${i}` : `Welcome credits ${i}`,
      scope: CreditGrantScope.Plan,
      credits: String(1000 * (i + 1)),
      cadence: recurring ? CreditGrantCadence.Recurring : CreditGrantCadence.OneTime,
      period: recurring ? CreditGrantPeriod.Monthly : null,
      periodCount: recurring ? 1 : null,
      expirationType: recurring ? CreditGrantExpiryType.BillingCycle : CreditGrantExpiryType.Never,
      expirationDuration: null,
      expirationDurationUnit: null,
      conversionRate: null,
      priority: i + 1,
      createdAt: new Date('2026-01-10T00:00:00Z'),
    }
  })
}
