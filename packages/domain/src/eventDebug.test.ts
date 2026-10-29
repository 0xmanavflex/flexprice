import { describe, expect, it } from 'vitest'
import {
  EVENT_DEBUG_STAGES,
  eventDebugSummary,
  missingAggregationFields,
  toEventDebug,
} from './eventDebug'

/**
 * A real `GET /events/lookup` response, trimmed to the fields this reads.
 *
 * Captured from the live API rather than written from V1's interfaces: which
 * is how the `external_id` / `external_customer_id` discrepancy on the
 * customer object turned up.
 */
const LIVE = {
  status: 'processing',
  event: { id: 'event_01M4NW8', idempotency_key: '' },
  events: [
    {
      id: 'event_01M4NW8',
      timestamp: '2026-10-11T16:20:48.685Z',
      ingested_at: '2026-10-11T16:20:48Z',
      properties: { data: 61 },
      source: 'onboarding',
    },
  ],
  debug_tracker: {
    customer_lookup: {
      status: 'found',
      customer: { id: 'cust_01M4GHH', external_id: 'cust-temp', name: 'temp' },
    },
    meter_matching: {
      status: 'found',
      matched_meters: [
        { meter_id: 'meter_01M4GHF', event_name: 'eventA', meter: { name: 'Feat A' } },
      ],
    },
    price_lookup: {
      status: 'found',
      matched_prices: [
        {
          price_id: 'price_01M4GHH',
          meter_id: 'meter_01M4GHF',
          status: 'published',
          price: { amount: '1', currency: 'usd' },
        },
      ],
    },
    subscription_line_item_lookup: {
      status: 'found',
      matched_line_items: [
        {
          sub_line_item_id: 'subs_line_01M4GHH',
          subscription_id: 'subs_01M4GHH',
          price_id: 'price_01M4GHH',
          is_active_for_event: true,
          timestamp_within_range: true,
        },
      ],
    },
    attributed_to_customer: {
      status: 'attributed',
      meter_usage: {
        meter_id: 'meter_01M4GHF',
        external_customer_id: 'cust-temp',
        qty_total: '61',
      },
    },
    failure_point: null,
  },
}

describe('toEventDebug', () => {
  it('reads a live response that went all the way through', () => {
    const debug = toEventDebug(LIVE)
    expect(debug.stages.map((stage) => stage.outcome)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
    ])
    expect(debug.failurePoint).toBeNull()
    expect(debug.attributedQuantity).toBe('61')
    expect(debug.customer).toEqual({
      id: 'cust_01M4GHH',
      externalId: 'cust-temp',
      name: 'temp',
    })
  })

  it('names each stage’s matches in a form a person can read', () => {
    const byStage = new Map(toEventDebug(LIVE).stages.map((s) => [s.stage, s]))
    expect(byStage.get('meterMatching')?.matches[0]).toMatchObject({
      label: 'Feat A',
      hint: 'eventA',
    })
    expect(byStage.get('priceLookup')?.matches[0]).toMatchObject({
      label: '1 USD',
      hint: 'published',
    })
    expect(byStage.get('subscriptionLineItemLookup')?.matches[0]).toMatchObject({
      subscriptionId: 'subs_01M4GHH',
      coversEvent: true,
    })
    expect(byStage.get('attributedToCustomer')?.matches[0]?.label).toBe('61 counted')
  })

  it('reads the customer under either spelling the wire uses', () => {
    const v1Spelling = {
      debug_tracker: {
        customer_lookup: {
          status: 'found',
          customer: { id: 'cus_1', external_customer_id: 'acme', name: 'Acme' },
        },
      },
    }
    expect(toEventDebug(v1Spelling).customer?.externalId).toBe('acme')
  })

  it('keeps every ingested version, newest first as the API sends them', () => {
    const debug = toEventDebug(LIVE)
    expect(debug.versions).toHaveLength(1)
    expect(debug.versions[0]).toMatchObject({ id: 'event_01M4NW8', source: 'onboarding' })
    expect(debug.versions[0]?.ingestedAt).toBeInstanceOf(Date)
  })

  it('reports a failure point and stops reading past it', () => {
    const failed = toEventDebug({
      status: 'failed',
      debug_tracker: {
        customer_lookup: { status: 'found', customer: { id: 'c', external_id: 'x', name: 'X' } },
        meter_matching: { status: 'not_found', error: { message: 'no meter for "widget.used"' } },
        price_lookup: { status: 'skipped' },
        subscription_line_item_lookup: { status: 'skipped' },
        attributed_to_customer: { status: 'skipped' },
        failure_point: { failure_point_type: 'meter_lookup' },
      },
    })
    const outcomes = failed.stages.map((stage) => stage.outcome)
    expect(outcomes).toEqual(['passed', 'failed', 'skipped', 'skipped', 'skipped'])
    expect(failed.stages[1]?.error).toBe('no meter for "widget.used"')
  })

  /*
   * `failure_point_type` is the wire's own spelling and does not match the
   * stage keys: the meter stage is `meter_matching` but its failure point is
   * `meter_lookup`. Mapping one to the other is what this guards.
   */
  it('maps the wire’s failure point names onto stages', () => {
    const cases: Array<[string, string | null]> = [
      ['customer_lookup', 'customerLookup'],
      ['price_lookup', 'priceLookup'],
      ['subscription_line_item_lookup', 'subscriptionLineItemLookup'],
      ['attributed_to_customer', 'attributedToCustomer'],
      ['something_new', null],
      ['', null],
    ]
    for (const [wire, expected] of cases) {
      const debug = toEventDebug({ debug_tracker: { failure_point: { failure_point_type: wire } } })
      expect(debug.failurePoint).toBe(expected)
    }
  })

  it('marks a line item that does not cover the event', () => {
    const debug = toEventDebug({
      debug_tracker: {
        subscription_line_item_lookup: {
          status: 'found',
          matched_line_items: [
            { sub_line_item_id: 'li_1', subscription_id: 'subs_1', timestamp_within_range: false },
          ],
        },
      },
    })
    const match = debug.stages.find((s) => s.stage === 'subscriptionLineItemLookup')?.matches[0]
    expect(match).toMatchObject({
      coversEvent: false,
      hint: 'Does not cover this event’s timestamp',
    })
  })

  it('answers with five skipped stages when there is no tracker at all', () => {
    for (const empty of [null, undefined, {}, 'nonsense']) {
      const debug = toEventDebug(empty)
      expect(debug.stages).toHaveLength(EVENT_DEBUG_STAGES.length)
      expect(debug.stages.every((stage) => stage.outcome === 'skipped')).toBe(true)
      expect(debug.failurePoint).toBeNull()
    }
  })

  /*
   * A summary is a judgement about what matters, and the field that explains
   * a given event is often one nobody thought to surface. Each stage keeps
   * its own response so the sheet can show the thing itself.
   */
  it('keeps each stage’s raw response', () => {
    const byStage = new Map(toEventDebug(LIVE).stages.map((s) => [s.stage, s]))
    expect(byStage.get('meterMatching')?.raw).toMatchObject({
      status: 'found',
      matched_meters: [expect.objectContaining({ meter_id: 'meter_01M4GHF' })],
    })
    // A stage the tracker never sent is an empty object, not undefined.
    expect(toEventDebug({}).stages[0]?.raw).toEqual({})
  })

  it('takes the ingestion time from the newest stored row', () => {
    expect(toEventDebug(LIVE).ingestedAt?.toISOString()).toBe('2026-10-11T16:20:48.000Z')
  })

  it('falls back to the event’s own timestamp when no row carries one', () => {
    const debug = toEventDebug({ event: { timestamp: '2026-01-02T03:04:05Z' } })
    expect(debug.ingestedAt?.toISOString()).toBe('2026-01-02T03:04:05.000Z')
  })

  it('does not read a bad timestamp as a date', () => {
    const debug = toEventDebug({ events: [{ id: 'e', ingested_at: 'not a date' }] })
    expect(debug.versions[0]?.ingestedAt).toBeNull()
  })
})

describe('eventDebugSummary', () => {
  it('says what was counted when everything passed', () => {
    expect(eventDebugSummary(toEventDebug(LIVE))).toBe(
      'Counted: this event added 61 to the customer’s usage.',
    )
  })

  it('explains each failure point in terms of what to go and fix', () => {
    const at = (type: string) =>
      eventDebugSummary(
        toEventDebug({ debug_tracker: { failure_point: { failure_point_type: type } } }),
      )
    expect(at('customer_lookup')).toMatch(/no customer has that external id/i)
    expect(at('meter_lookup')).toMatch(/no meter listens for that event name/i)
    expect(at('price_lookup')).toMatch(/no published price/i)
    expect(at('subscription_line_item_lookup')).toMatch(/no live contract/i)
    expect(at('attributed_to_customer')).toMatch(/not added to the customer/i)
  })
})

describe('toEventDebug processed usage', () => {
  it('reads each line item the event was counted against from processed_events', () => {
    const debug = toEventDebug({
      ...LIVE,
      processed_events: [
        {
          customer_id: 'cust_01',
          subscription_id: 'subs_01',
          sub_line_item_id: 'subs_line_01',
          price_id: 'price_01',
          meter_id: 'meter_01',
          feature_id: 'feat_01',
          qty_total: '1',
          processed_at: '2026-10-20T00:46:41Z',
        },
        {
          customer_id: 'cust_01',
          subscription_id: 'subs_01',
          sub_line_item_id: 'subs_line_02',
          price_id: 'price_02',
          meter_id: 'meter_01',
          feature_id: 'feat_01',
          qty_total: '2.5',
        },
      ],
    })

    expect(debug.processedUsage).toEqual([
      {
        customerId: 'cust_01',
        subscriptionId: 'subs_01',
        lineItemId: 'subs_line_01',
        priceId: 'price_01',
        meterId: 'meter_01',
        featureId: 'feat_01',
        quantity: '1',
        processedAt: new Date('2026-10-20T00:46:41Z'),
      },
      {
        customerId: 'cust_01',
        subscriptionId: 'subs_01',
        lineItemId: 'subs_line_02',
        priceId: 'price_02',
        meterId: 'meter_01',
        featureId: 'feat_01',
        quantity: '2.5',
        processedAt: null,
      },
    ])
  })

  it('is empty before the event has been processed', () => {
    expect(toEventDebug(LIVE).processedUsage).toEqual([])
  })
})

describe('missingAggregationFields', () => {
  const withMeters = (meters: unknown[]) =>
    toEventDebug({
      ...LIVE,
      debug_tracker: {
        ...LIVE.debug_tracker,
        meter_matching: { status: 'found', matched_meters: meters },
      },
    })
  const meter = (aggregation: Record<string, unknown>) => ({
    meter_id: 'meter_1',
    event_name: 'tokens',
    meter: { name: 'Tokens', aggregation },
  })

  it('names a meter whose field the event does not carry', () => {
    const debug = withMeters([meter({ type: 'SUM', field: 'tokens' })])
    expect(missingAggregationFields(debug, { model: 'gpt' })).toEqual([
      { meterId: 'meter_1', meterName: 'Tokens', field: 'tokens', aggregation: 'SUM' },
    ])
  })

  it('is quiet when the field is there, even as zero', () => {
    const debug = withMeters([meter({ type: 'SUM', field: 'tokens' })])
    expect(missingAggregationFields(debug, { tokens: 0 })).toEqual([])
  })

  it('ignores counts and expressions, which read no single field', () => {
    const debug = withMeters([
      meter({ type: 'COUNT', field: '' }),
      meter({ type: 'SUM', field: 'tokens', expression: 'properties.a * 2' }),
    ])
    expect(missingAggregationFields(debug, {})).toEqual([])
  })

  it('is quiet when no meter matched', () => {
    expect(missingAggregationFields(withMeters([]), {})).toEqual([])
  })
})
