import { describe, expect, it, vi } from 'vitest'
import {
  CreateSubscriptionRequest$outboundSchema,
  ExecuteSubscriptionModifyRequest$outboundSchema,
  UpdateSubscriptionLineItemRequest$outboundSchema,
  CreateEntitlementRequest$outboundSchema,
  DeleteCreditGrantRequest$outboundSchema,
  UpdateSubscriptionRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import {
  BillingModel,
  CommitmentKind,
  emptySpendingAllowance,
  emptySubscription,
  type Entitlement,
} from '@fp/domain'
import {
  toAddCouponRequest,
  toCancelCreditGrantRequest,
  toAddAddonsRequest,
  toCreateSubscriptionRequest,
  toUpdateLineItemRequest,
  toInheritanceChangeRequest,
} from './subscriptions'
import { toContractEntitlementOverride } from './contractBenefits'
import { collectPickerPages } from './contractPickers'

const allowance = {
  ...emptySpendingAllowance(),
  quota: '150.25',
  unit: 'week' as const,
  every: 2,
  startDate: '2026-11-08',
  endDate: '2026-12-08',
}

describe('contract amendments survive SDK serialization', () => {
  it('creates a featureless spending allowance with its own cadence and dates', () => {
    const request = toCreateSubscriptionRequest({
      ...emptySubscription(),
      customerId: 'customer',
      planId: 'plan',
      currency: 'USD',
      spendingAllowances: [allowance],
    })
    expect(
      CreateSubscriptionRequest$outboundSchema.parse(request).subscription_entitlement_grants,
    ).toEqual([
      {
        grant_quota: '150.25',
        grant_duration_unit: 'week',
        grant_duration_value: 2,
        grant_allocation_behavior: 'first_usage',
        aggregation_mode: 'additive',
        start_date: '2026-11-08T00:00:00.000Z',
        end_date: '2026-12-08T00:00:00.000Z',
      },
    ])
  })
  it('keeps coupon dates for a line without also setting contract scope', () => {
    expect(
      ExecuteSubscriptionModifyRequest$outboundSchema.parse(
        toAddCouponRequest('sub', {
          couponCode: 'SAVE',
          lineItemId: 'line',
          startDate: '2026-11-08',
          endDate: '2026-12-08',
        }),
      ).coupon_params,
    ).toEqual({
      action: 'add',
      coupon_code: 'SAVE',
      subscription_line_item_id: 'line',
      start_date: '2026-11-08T00:00:00.000Z',
      end_date: '2026-12-08T00:00:00.000Z',
    })
  })
  it('adds and removes add-ons in a single net modification', () => {
    expect(
      ExecuteSubscriptionModifyRequest$outboundSchema.parse(
        toAddAddonsRequest('sub', [{ addonId: 'new-addon' }], ['old-association']),
      ).addon_bulk_params,
    ).toEqual({
      adds: [{ addon_id: 'new-addon' }],
      removes: [{ addon_association_id: 'old-association' }],
    })
  })
  it('preserves bucket IDs without replacing their existing prices', () => {
    const request = toUpdateLineItemRequest({
      price: { priceId: 'price', billingModel: BillingModel.FlatFee, amount: '1' },
      priceUnit: '',
      effectiveFrom: '',
      terms: {
        bucketSize: '',
        commitment: {
          kind: CommitmentKind.Amount,
          value: '10',
          windowed: true,
          overageFactor: '1',
          trueUp: false,
          windows: [
            {
              id: 'bucket',
              start: '08:30',
              end: '17:00',
              kind: CommitmentKind.Quantity,
              value: '100',
              overageFactor: '1.5',
              trueUp: true,
              priceId: 'keep-this-price',
            },
          ],
        },
      },
    })
    expect(
      UpdateSubscriptionLineItemRequest$outboundSchema.parse(request).commitment_time_buckets,
    ).toEqual([
      {
        id: 'bucket',
        start: { hour: 8, minute: 30 },
        end: { hour: 17, minute: 0 },
        commitment_type: 'quantity',
        commitment_value: '100',
        overage_factor: '1.5',
        true_up_enabled: true,
      },
    ])
  })
  it('explicitly clears time windows', () => {
    const request = toUpdateLineItemRequest({
      price: { priceId: 'price', billingModel: BillingModel.FlatFee, amount: '1' },
      priceUnit: '',
      effectiveFrom: '',
      terms: {
        bucketSize: '',
        commitment: {
          kind: CommitmentKind.Amount,
          value: '10',
          windowed: false,
          overageFactor: '1',
          trueUp: false,
          windows: [],
        },
      },
    })
    expect(
      UpdateSubscriptionLineItemRequest$outboundSchema.parse(request).commitment_time_buckets,
    ).toEqual([])
  })
  it('targets external IDs when changing inherited customers', () => {
    expect(
      ExecuteSubscriptionModifyRequest$outboundSchema.parse(
        toInheritanceChangeRequest('remove', ['external-child']),
      ).inheritance_params,
    ).toEqual({ action: 'remove', external_customer_ids_to_remove: ['external-child'] })
  })
  it('creates a contract override linked to exactly the selected inherited source', () => {
    const source = {
      id: 'plan-entitlement',
      featureId: 'feature',
      featureType: 'boolean',
    } as Entitlement
    expect(
      CreateEntitlementRequest$outboundSchema.parse(
        toContractEntitlementOverride('sub', source, { isEnabled: false }),
      ),
    ).toEqual({
      entity_type: 'SUBSCRIPTION',
      entity_id: 'sub',
      feature_id: 'feature',
      feature_type: 'boolean',
      parent_entitlement_id: 'plan-entitlement',
      is_enabled: false,
    })
  })
})

describe('complete contract pickers', () => {
  it('includes results after the first hundred without truncating selection', async () => {
    const data = Array.from({ length: 235 }, (_, i) => `item-${i}`)
    const fetch = vi.fn(async (page: number) => ({
      items: data.slice((page - 1) * 100, page * 100),
      total: data.length,
    }))
    expect(await collectPickerPages(fetch)).toEqual(data)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('does not present partial results as a complete catalogue after a later page fails', async () => {
    await expect(
      collectPickerPages(async (page) => {
        if (page === 2) throw new Error('failed')
        return { items: ['first'], total: 2 }
      }),
    ).rejects.toThrow('failed')
  })
})

it('creates new bucket prices in subscription scope and avoids repricing the base line for a terms-only edit', () => {
  const result = UpdateSubscriptionLineItemRequest$outboundSchema.parse(
    toUpdateLineItemRequest({
      subscriptionId: 'sub',
      priceChanged: false,
      price: { priceId: 'base', billingModel: BillingModel.FlatFee, amount: '2' },
      windowPrice: {
        type: 'USAGE',
        billingModel: BillingModel.FlatFee,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ARREAR',
        meterId: 'meter',
        displayName: 'API calls',
        amount: '2',
      },
      priceUnit: '',
      effectiveFrom: '',
      terms: {
        bucketSize: '',
        commitment: {
          kind: CommitmentKind.Amount,
          value: '10',
          windowed: true,
          overageFactor: '1',
          trueUp: false,
          windows: [
            {
              id: '',
              start: '09:00',
              end: '17:00',
              value: '10',
              overageFactor: '1',
              trueUp: false,
            },
          ],
        },
      },
    }),
  )
  expect(result).not.toHaveProperty('billing_model')
  expect(result.commitment_windowed).toBe(true)
  expect(result.commitment_time_buckets?.[0]?.price).toMatchObject({
    entity_id: 'sub',
    entity_type: 'SUBSCRIPTION',
    meter_id: 'meter',
    amount: '2',
  })
  expect(result.commitment_time_buckets?.[0]).not.toHaveProperty('id')
})

it('clears both commitment kinds and stored windows when the commitment is removed', () => {
  const result = toUpdateLineItemRequest({
    clearCommitment: true,
    priceChanged: false,
    price: { priceId: 'base', billingModel: BillingModel.FlatFee, amount: '1' },
    priceUnit: '',
    effectiveFrom: '',
    terms: { bucketSize: '', commitment: null },
  })
  expect(result).toEqual({
    commitmentAmount: 0,
    commitmentQuantity: 0,
    commitmentWindowed: false,
    commitmentTrueUpEnabled: false,
    commitmentTimeBuckets: [],
  })
})

it('sends the selected credit-grant cancellation day rather than now', () => {
  expect(
    DeleteCreditGrantRequest$outboundSchema.parse(toCancelCreditGrantRequest('2027-01-15')),
  ).toEqual({ effective_date: '2027-01-15T00:00:00.000Z' })
})

// The API reads `parent_subscription_id: ""` as "clear the parent" and an omitted one as
// "leave it" (dto.UpdateSubscriptionRequest), so No parent must reach the wire as "".
it('sends an empty parent id to detach the contract from its parent', () => {
  expect(UpdateSubscriptionRequest$outboundSchema.parse({ parentSubscriptionId: '' })).toEqual({
    parent_subscription_id: '',
  })
})
