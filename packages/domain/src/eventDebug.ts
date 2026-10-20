/**
 * Why an event did or did not bill.
 *
 * The events list answers "did it arrive"; this answers the question people
 * actually open a debugger for. The backend walks an ingested event through
 * five stages and reports where it got to:
 *
 *   1. the external customer id is matched to a customer
 *   2. the event name is matched to one or more meters
 *   3. those meters are matched to published prices
 *   4. those prices are matched to line items on live subscriptions
 *   5. the quantity is attributed to the customer's usage
 *
 * A stage that fails stops the rest, and `failurePoint` names it. That is the
 * whole value: "nothing matched this event name" and "it matched, but no
 * subscription carries that price" are the same silence on the invoice and
 * completely different problems.
 *
 * Ported from V1's `src/types/dto/Events.ts`, checked against a live
 * `GET /events/lookup` rather than taken from the types alone — the customer
 * object is keyed `external_id` there, not `external_customer_id` as the V1
 * interface claims.
 */

/** The five stages, in the order the backend runs them. */
export const EVENT_DEBUG_STAGES = [
  'customerLookup',
  'meterMatching',
  'priceLookup',
  'subscriptionLineItemLookup',
  'attributedToCustomer',
] as const
export type EventDebugStage = (typeof EVENT_DEBUG_STAGES)[number]

export const EVENT_DEBUG_STAGE_LABEL: Record<EventDebugStage, string> = {
  customerLookup: 'Customer matched',
  meterMatching: 'Meter matched',
  priceLookup: 'Price found',
  subscriptionLineItemLookup: 'On a live contract',
  attributedToCustomer: 'Counted towards usage',
}

/** What each stage says about itself, once the wire's many spellings are collapsed. */
export type EventDebugOutcome = 'passed' | 'failed' | 'skipped'

export interface EventDebugStageResult {
  stage: EventDebugStage
  outcome: EventDebugOutcome
  /** The raw status word the backend used, kept for the detail line. */
  status: string
  /** The backend's own explanation, when it gave one. */
  error: string | null
  /** What this stage matched, one line each. Empty when it matched nothing. */
  matches: EventDebugMatch[]
  /**
   * The stage's own response, untouched.
   *
   * The readable rows above are a summary and a summary is a judgement about
   * what matters. A debugger has to be able to show the thing itself, because
   * the field that explains a given event is often one nobody thought to
   * surface — V1 puts the raw JSON behind every step for the same reason.
   */
  raw: Record<string, unknown>
}

export interface EventDebugMatch {
  id: string
  label: string
  hint?: string | undefined
  /** Set when the match is a subscription, so the row can link to it. */
  subscriptionId?: string | undefined
  /** False when a line item exists but does not cover this event's timestamp. */
  coversEvent?: boolean | undefined
}

export interface EventDebug {
  /** The backend's overall word: `processing`, `processed`, and so on. */
  status: string
  stages: EventDebugStageResult[]
  /** The stage that stopped it, or null when nothing did. */
  failurePoint: EventDebugStage | null
  /** The quantity this event added, when it was counted. */
  attributedQuantity: string | null
  /** The customer it was matched to. */
  customer: { id: string; externalId: string; name: string } | null
  /**
   * Where the event was billed: one entry per subscription line item it was
   * counted against (`processed_events`). Empty until it has been processed,
   * and more than one when it matches several line items.
   */
  processedUsage: ProcessedUsage[]
  /** Every raw row stored under this event id, newest first. */
  versions: EventVersion[]
  /** Set when the sender supplied one, so replays can be explained. */
  idempotencyKey: string | null
  /** When the event reached Flexprice, which is where the trace starts. */
  ingestedAt: Date | null
}

/** One line item an event was counted against, as `processed_events` reports it. */
export interface ProcessedUsage {
  customerId: string
  subscriptionId: string
  lineItemId: string
  priceId: string
  meterId: string
  featureId: string
  /** The quantity counted, as the decimal string the API sent. */
  quantity: string
  processedAt: Date | null
}

export interface EventVersion {
  id: string
  ingestedAt: Date | null
  timestamp: Date | null
  source: string
  properties: Record<string, unknown>
}

/** Wire status words that mean the stage did its job. */
const PASSED = new Set(['found', 'matched', 'attributed', 'success', 'ok', 'completed'])
/** Wire status words that mean it was never reached. */
const SKIPPED = new Set(['skipped', 'not_run', 'pending', ''])

/**
 * The field each stage occupies on the wire.
 *
 * Exported because the debugger shows it: when you are reading a raw
 * response, the useful label is the key it came from, not the friendly name
 * of the row it sits under.
 */
export const EVENT_DEBUG_STAGE_WIRE: Record<EventDebugStage, string> = {
  customerLookup: 'customer_lookup',
  meterMatching: 'meter_matching',
  priceLookup: 'price_lookup',
  subscriptionLineItemLookup: 'subscription_line_item_lookup',
  attributedToCustomer: 'attributed_to_customer',
}

/**
 * `failure_point_type` → stage.
 *
 * Not derivable from `EVENT_DEBUG_STAGE_WIRE`: the meter stage is keyed `meter_matching`
 * on the tracker but reported as `meter_lookup` when it is the failure point.
 * Deriving one from the other silently swallowed every meter failure — the
 * worst of the five to lose, since "no meter listens for that event name" is
 * the most common reason an event does not bill.
 */
const STAGE_BY_FAILURE_POINT: Record<string, EventDebugStage> = {
  customer_lookup: 'customerLookup',
  meter_lookup: 'meterMatching',
  meter_matching: 'meterMatching',
  price_lookup: 'priceLookup',
  subscription_line_item_lookup: 'subscriptionLineItemLookup',
  attributed_to_customer: 'attributedToCustomer',
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function date(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** The backend's error object, as one sentence. */
function errorOf(stage: Record<string, unknown>): string | null {
  const error = record(stage['error'])
  const message = text(error['message']) || text(error['error']) || text(stage['error'])
  return message || null
}

function outcomeOf(status: string, hasError: boolean): EventDebugOutcome {
  const word = status.toLowerCase()
  if (PASSED.has(word)) return 'passed'
  if (SKIPPED.has(word) && !hasError) return 'skipped'
  return 'failed'
}

/** The matches a stage found, each as one readable row. */
function matchesOf(stage: EventDebugStage, raw: Record<string, unknown>): EventDebugMatch[] {
  switch (stage) {
    case 'customerLookup': {
      const customer = record(raw['customer'])
      const id = text(customer['id'])
      if (!id) return []
      return [
        {
          id,
          label: text(customer['name']) || id,
          hint:
            text(customer['external_id']) || text(customer['external_customer_id']) || undefined,
        },
      ]
    }
    case 'meterMatching':
      return list(raw['matched_meters']).map((match) => {
        const meter = record(match['meter'])
        const id = text(match['meter_id'])
        return {
          id,
          label: text(meter['name']) || id,
          hint: text(match['event_name']) || undefined,
        }
      })
    case 'priceLookup':
      return list(raw['matched_prices']).map((match) => {
        const price = record(match['price'])
        const id = text(match['price_id'])
        const amount = text(price['amount'])
        return {
          id,
          label: amount ? `${amount} ${text(price['currency']).toUpperCase()}`.trim() : id,
          hint: text(match['status']) || undefined,
        }
      })
    case 'subscriptionLineItemLookup':
      return list(raw['matched_line_items']).map((match) => {
        const subscriptionId = text(match['subscription_id'])
        const covers =
          match['is_active_for_event'] !== false && match['timestamp_within_range'] !== false
        return {
          id: text(match['sub_line_item_id']),
          label: subscriptionId || text(match['sub_line_item_id']),
          hint: covers ? undefined : 'Does not cover this event’s timestamp',
          subscriptionId: subscriptionId || undefined,
          coversEvent: covers,
        }
      })
    case 'attributedToCustomer': {
      const usage = record(raw['meter_usage'])
      const meterId = text(usage['meter_id'])
      if (!meterId) return []
      return [{ id: meterId, label: `${text(usage['qty_total']) || '0'} counted`, hint: meterId }]
    }
  }
}

/**
 * The lookup response, as something the sheet can render.
 *
 * Total: a response missing the tracker entirely (an event too old to trace,
 * or one the backend has not processed yet) yields five skipped stages rather
 * than an error, because "we cannot say" is a real answer and not a failure.
 */
export function toEventDebug(wire: unknown): EventDebug {
  const body = record(wire)
  const tracker = record(body['debug_tracker'])
  const event = record(body['event'])

  const stages: EventDebugStageResult[] = EVENT_DEBUG_STAGES.map((stage) => {
    const raw = record(tracker[EVENT_DEBUG_STAGE_WIRE[stage]])
    const status = text(raw['status'])
    const error = errorOf(raw)
    return {
      stage,
      outcome: outcomeOf(status, error !== null),
      status,
      error,
      matches: matchesOf(stage, raw),
      raw,
    }
  })

  const failureWire = text(record(tracker['failure_point'])['failure_point_type'])
  const customerRaw = record(record(tracker['customer_lookup'])['customer'])
  const usage = record(record(tracker['attributed_to_customer'])['meter_usage'])

  return {
    status: text(body['status']) || 'unknown',
    stages,
    failurePoint: STAGE_BY_FAILURE_POINT[failureWire] ?? null,
    attributedQuantity: text(usage['qty_total']) || null,
    customer: text(customerRaw['id'])
      ? {
          id: text(customerRaw['id']),
          externalId: text(customerRaw['external_id']) || text(customerRaw['external_customer_id']),
          name: text(customerRaw['name']),
        }
      : null,
    processedUsage: list(body['processed_events']).map((row) => ({
      customerId: text(row['customer_id']),
      subscriptionId: text(row['subscription_id']),
      lineItemId: text(row['sub_line_item_id']),
      priceId: text(row['price_id']),
      meterId: text(row['meter_id']),
      featureId: text(row['feature_id']),
      quantity: text(row['qty_total']) || '0',
      processedAt: date(row['processed_at']),
    })),
    versions: list(body['events']).map((row) => ({
      id: text(row['id']),
      ingestedAt: date(row['ingested_at']),
      timestamp: date(row['timestamp']),
      source: text(row['source']),
      properties: record(row['properties']),
    })),
    idempotencyKey: text(event['idempotency_key']) || null,
    // The newest stored row is the one the list showed, so its ingestion is
    // the moment this trace begins.
    ingestedAt:
      date(record(list(body['events'])[0])['ingested_at']) ??
      date(event['ingested_at']) ??
      date(event['timestamp']),
  }
}

/**
 * One sentence saying what happened to this event.
 *
 * The stage list says where it stopped; this says what that means, because
 * "subscription_line_item_lookup: not_found" is not an answer anybody can act
 * on without already knowing the pipeline.
 */
export function eventDebugSummary(debug: EventDebug): string {
  if (debug.failurePoint === null) {
    return debug.attributedQuantity
      ? `Counted: this event added ${debug.attributedQuantity} to the customer’s usage.`
      : 'This event went through every stage.'
  }
  switch (debug.failurePoint) {
    case 'customerLookup':
      return 'No customer has that external id, so the event belongs to nobody and cannot bill.'
    case 'meterMatching':
      return 'No meter listens for that event name, so nothing measured it.'
    case 'priceLookup':
      return 'A meter matched, but no published price bills against it.'
    case 'subscriptionLineItemLookup':
      return 'A price matched, but no live contract carries it at this event’s timestamp.'
    case 'attributedToCustomer':
      return 'Everything matched, but the quantity was not added to the customer’s usage.'
  }
}
