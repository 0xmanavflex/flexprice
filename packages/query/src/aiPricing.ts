import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, call, parsePricing } from '@fp/api'
import {
  AI_SETUP_METADATA,
  AggregationType,
  BillingModel,
  BillingPeriod,
  CreditGrantCadence,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  CreditGrantScope,
  EntitlementEntityType,
  FeatureType,
  GEMINI_PRICING_SCHEMA,
  InvoiceCadence,
  PriceEntityType,
  PriceType,
  ResetUsage,
  SYSTEM_PROMPT,
  type PricingPlan,
  type PricingSchema,
  type CreateCharge,
  type CreateFeature,
  type PricingUsageCharge,
  buildPricingPrompt,
  normalisePricingSchema,
} from '@fp/domain'
import { toCreateFeatureRequest } from './features'
import { toCreatePlanRequest } from './plans'
import { toChargeRequest } from './prices'
import { toCreditGrantRequest } from './creditGrants'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Turning a description of a pricing page into a catalogue.
 *
 * Two steps, deliberately apart. {@link useParsePricing} asks the backend to
 * read the description and answers a schema, writing nothing; applying that
 * schema is {@link useApplyPricingSchema}, which runs only once someone has
 * seen what it would create. V1 runs them from one screen the same way
 * (`src/api/ai/orchestrator.ts`).
 */

export function useParsePricing() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useMutation({
    mutationFn: async (description: string): Promise<PricingSchema> => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to use this.')
      const body = await parsePricing(serverURL, token, environmentId ?? '', {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildPricingPrompt(description),
        responseSchema: GEMINI_PRICING_SCHEMA as Record<string, unknown>,
      })
      return normalisePricingSchema(body)
    },
  })
}

/** Which part of the schema is being written, for the progress list. */
export type ApplyStep = 'features' | 'plans' | 'prices' | 'entitlements' | 'creditGrants' | 'done'

export const APPLY_STEP_LABEL: Record<ApplyStep, string> = {
  features: 'Creating features',
  plans: 'Creating plans',
  prices: 'Pricing the plans',
  entitlements: 'Adding entitlements',
  creditGrants: 'Granting credits',
  done: 'Done',
}

export interface ApplyResult {
  featureIds: Record<string, string>
  planIds: Record<string, string>
}

/** The steps this schema will actually run: the empty ones are not shown. */
export function applySteps(schema: PricingSchema): ApplyStep[] {
  const steps: ApplyStep[] = ['features', 'plans', 'prices']
  if (schema.plans.some((plan) => plan.entitlements.length > 0)) steps.push('entitlements')
  if (schema.creditGrants.length > 0) steps.push('creditGrants')
  steps.push('done')
  return steps
}

/**
 * A usage charge as a `CreateCharge`, so the console's own mapper sends it.
 *
 * Building the wire body here instead would be a second place that has to
 * know what the prices API takes: `toChargeRequest` already does, and is
 * what the charge form goes through.
 */
function toUsageCharge(charge: PricingUsageCharge, meterId: string): CreateCharge {
  const base = {
    type: PriceType.Usage,
    currency: charge.currency,
    billingPeriod: charge.billingPeriod === 'annual' ? BillingPeriod.Annual : BillingPeriod.Monthly,
    invoiceCadence: InvoiceCadence.Arrear,
    meterId,
    ...(charge.displayName ? { displayName: charge.displayName } : {}),
  }
  return charge.billingModel === 'package' && charge.packageSize
    ? {
        ...base,
        billingModel: BillingModel.Package,
        amount: String(charge.amountPerUnit),
        divideBy: charge.packageSize,
      }
    : { ...base, billingModel: BillingModel.FlatFee, amount: String(charge.amountPerUnit) }
}

/** A plan's fixed price as a `CreateCharge`. */
function toFixedPrice(price: PricingPlan['prices'][number]): CreateCharge {
  return {
    type: PriceType.Fixed,
    currency: price.currency,
    // A one-time price is sent as monthly: the parser can say `one_time` but
    // this flow creates recurring plan pricing, and the plan form is where a
    // genuine one-off fee is configured.
    billingPeriod: price.billingPeriod === 'annual' ? BillingPeriod.Annual : BillingPeriod.Monthly,
    invoiceCadence: InvoiceCadence.Advance,
    billingModel: BillingModel.FlatFee,
    amount: String(price.amount),
  }
}

/**
 * Writes the schema: features, then plans, then everything that points at
 * them.
 *
 * Order matters and is not parallelised: a price needs its plan's id and a
 * usage charge needs its feature's meter id. A feature whose lookup key is
 * already taken is adopted rather than duplicated, which is what makes
 * running this twice safe; V1 does the same pre-check.
 *
 * Everything created is tagged `created_with_ai`, so it can be found later.
 */
export function useApplyPricingSchema() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      schema,
      onStep,
    }: {
      schema: PricingSchema
      onStep?: (step: ApplyStep) => void
    }): Promise<ApplyResult> => {
      const featureIds: Record<string, string> = {}
      const meterIds: Record<string, string> = {}
      const planIds: Record<string, string> = {}

      onStep?.('features')
      for (const feature of schema.features) {
        // Adopt an existing feature rather than making a second one with the
        // same key: this is what lets the flow be run twice without piling up
        // duplicates.
        const found = (await call(() =>
          client.features.queryFeature({ lookupKeys: [feature.key], limit: 1, expand: 'meters' }),
        )) as { items?: Array<{ id?: string; meterId?: string; meter?: { id?: string } }> }
        const existing = found.items?.[0]
        if (existing?.id) {
          featureIds[feature.key] = existing.id
          const meterId = existing.meterId ?? existing.meter?.id
          if (meterId) meterIds[feature.key] = meterId
          continue
        }

        const metered = feature.type === 'metered'
        const draft: CreateFeature = {
          name: feature.name,
          lookupKey: feature.key,
          description: '',
          unitSingular: feature.unitSingular,
          unitPlural: feature.unitPlural,
          ...(metered
            ? {
                type: FeatureType.Metered,
                meter: {
                  eventName: feature.eventName,
                  aggregationType:
                    feature.aggregation === 'sum' ? AggregationType.Sum : AggregationType.Count,
                  resetUsage: ResetUsage.BillingPeriod,
                  ...(feature.aggregationField ? { field: feature.aggregationField } : {}),
                },
              }
            : { type: FeatureType.Static }),
        }
        const created = (await call(() =>
          client.features.createFeature({
            ...toCreateFeatureRequest(draft),
            metadata: AI_SETUP_METADATA,
          } as never),
        )) as { id?: string; meterId?: string; meter?: { id?: string } }
        if (created.id) featureIds[feature.key] = created.id
        const meterId = created.meterId ?? created.meter?.id
        if (meterId) meterIds[feature.key] = meterId
      }

      onStep?.('plans')
      for (const plan of schema.plans) {
        const created = (await call(() =>
          client.plans.createPlan({
            ...toCreatePlanRequest({ name: plan.name, description: plan.description }),
            metadata: AI_SETUP_METADATA,
          } as never),
        )) as { id?: string }
        if (created.id) planIds[plan.name] = created.id
      }

      onStep?.('prices')
      for (const plan of schema.plans) {
        const planId = planIds[plan.name]
        if (!planId) continue
        const charges = [
          ...plan.prices.map(toFixedPrice),
          ...plan.usageCharges.flatMap((charge) => {
            const meterId = meterIds[charge.featureKey]
            // No meter means nothing to bill against. Skipped rather than sent
            // and rejected halfway through the plan.
            return meterId ? [toUsageCharge(charge, meterId)] : []
          }),
        ]
        if (charges.length === 0) continue
        await call(() =>
          client.prices.createPricesBulk({
            items: charges.map((charge) => toChargeRequest(charge, PriceEntityType.Plan, planId)),
          } as never),
        )
      }

      const withEntitlements = schema.plans.filter((plan) => plan.entitlements.length > 0)
      if (withEntitlements.length > 0) {
        onStep?.('entitlements')
        for (const plan of withEntitlements) {
          const planId = planIds[plan.name]
          if (!planId) continue
          const items = plan.entitlements.flatMap((entitlement) => {
            const featureId = featureIds[entitlement.featureKey]
            if (!featureId) return []
            const feature = schema.features.find((f) => f.key === entitlement.featureKey)
            const metered = feature?.type === 'metered'
            return [
              {
                entityType: EntitlementEntityType.Plan,
                entityId: planId,
                featureId,
                featureType: metered ? FeatureType.Metered : FeatureType.Static,
                isEnabled: true,
                ...(metered
                  ? {
                      usageLimit: entitlement.isUnlimited ? null : entitlement.value,
                      usageResetPeriod: ResetUsage.BillingPeriod,
                      isSoftLimit: false,
                    }
                  : {
                      staticValue: entitlement.isUnlimited
                        ? 'Unlimited'
                        : String(entitlement.value ?? ''),
                    }),
              },
            ]
          })
          if (items.length === 0) continue
          await call(() => client.entitlements.createEntitlementsBulk({ items } as never))
        }
      }

      if (schema.creditGrants.length > 0) {
        onStep?.('creditGrants')
        for (const grant of schema.creditGrants) {
          const planId = planIds[grant.planName]
          if (!planId) continue
          await call(() =>
            client.creditGrants.createCreditGrant(
              toCreditGrantRequest(
                {
                  name: grant.name,
                  credits: String(grant.credits),
                  cadence:
                    grant.cadence === 'recurring'
                      ? CreditGrantCadence.Recurring
                      : CreditGrantCadence.OneTime,
                  ...(grant.period
                    ? {
                        period:
                          grant.period === 'annual'
                            ? CreditGrantPeriod.Annual
                            : CreditGrantPeriod.Monthly,
                      }
                    : {}),
                  expirationType: CreditGrantExpiryType.Never,
                  priority: 1,
                } as never,
                CreditGrantScope.Plan,
                planId,
              ) as never,
            ),
          )
        }
      }

      onStep?.('done')
      return { featureIds, planIds }
    },
    onSuccess: () => {
      // Everything this touched, at once: the catalogue is a different place
      // than it was a minute ago.
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.prices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.entitlements.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditGrants.all() })
    },
  })
}
