import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { toEventDebug } from '@fp/domain'
import { EventDetailSheet } from './EventDetailSheet'

/** A trace that went all the way through, in the wire's own shape. */
const TRACED = toEventDebug({
  status: 'processed',
  event: { id: 'evt_01', idempotency_key: 'idem_7f2a' },
  events: [
    { id: 'evt_01', source: 'sdk', ingested_at: '2026-09-01T10:15:31Z' },
    { id: 'evt_01', source: 'sdk', ingested_at: '2026-09-01T10:15:30Z' },
  ],
  debug_tracker: {
    customer_lookup: {
      status: 'found',
      customer: { id: 'cust_01', external_id: 'acme-corp', name: 'Acme Corp' },
    },
    meter_matching: {
      status: 'found',
      matched_meters: [{ meter_id: 'mtr_1', event_name: 'api_call', meter: { name: 'API Calls' } }],
    },
    price_lookup: {
      status: 'found',
      matched_prices: [
        {
          price_id: 'price_1',
          meter_id: 'mtr_1',
          status: 'published',
          price: { amount: '0.01', currency: 'usd' },
        },
      ],
    },
    subscription_line_item_lookup: {
      status: 'found',
      matched_line_items: [
        {
          sub_line_item_id: 'li_1',
          subscription_id: 'subs_1',
          is_active_for_event: true,
          timestamp_within_range: true,
        },
      ],
    },
    attributed_to_customer: {
      status: 'attributed',
      meter_usage: { meter_id: 'mtr_1', external_customer_id: 'acme-corp', qty_total: '412' },
    },
    failure_point: null,
  },
})

/** The common failure: nothing is listening for that event name. */
const NO_METER = toEventDebug({
  status: 'failed',
  debug_tracker: {
    customer_lookup: {
      status: 'found',
      customer: { id: 'cust_01', external_id: 'acme-corp', name: 'Acme Corp' },
    },
    meter_matching: {
      status: 'not_found',
      error: { message: 'No meter is configured for "api_call".' },
    },
    price_lookup: { status: 'skipped' },
    subscription_line_item_lookup: { status: 'skipped' },
    attributed_to_customer: { status: 'skipped' },
    failure_point: { failure_point_type: 'meter_lookup' },
  },
})

const meta = {
  title: 'App/Developers/Events/Event detail sheet',
  component: EventDetailSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: fn(),
    locale: 'en-US',
    event: {
      id: 'evt_01',
      eventName: 'api_call',
      externalCustomerId: 'acme-corp',
      customerId: 'cust_01',
      source: 'sdk',
      timestamp: new Date('2026-09-01T10:15:30Z'),
      properties: { endpoint: '/v1/search', tokens: 412 },
    },
  },
  argTypes: {
    event: { control: 'object' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onClose: { control: false },
  },
} satisfies Meta<typeof EventDetailSheet>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof EventDetailSheet> & {
  open: boolean
  eventName: string
  matched: boolean
  hasTimestamp: boolean
  propertyCount: number
}

/** Deterministic: the same count always gives the same properties. */
function makeProperties(count: number): Record<string, unknown> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`property_${index + 1}`, index * 7 + 1]),
  )
}

/** Open or close the sheet; toggle a matched customer, a timestamp and how many properties it carries. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { open: true, eventName: 'api_call', matched: true, hasTimestamp: true, propertyCount: 4 },
  argTypes: {
    event: { control: false },
    propertyCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
  },
  render: ({ open, eventName, matched, hasTimestamp, propertyCount, ...args }) => (
    <EventDetailSheet
      {...args}
      event={
        open
          ? {
              id: 'evt_playground',
              eventName,
              externalCustomerId: 'acme-corp',
              customerId: matched ? 'cust_01' : '',
              source: matched ? 'sdk' : '',
              timestamp: hasTimestamp ? new Date('2026-09-01T10:15:30Z') : null,
              properties: makeProperties(propertyCount),
            }
          : null
      }
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // The sheet portals out of the canvas.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('api_call')).toBeInTheDocument()
    await expect(screen.getByText('evt_01')).toBeInTheDocument()
    await expect(screen.getByText('Properties')).toBeInTheDocument()
  },
}

export const Unmatched: Story = {
  args: {
    event: {
      id: 'evt_02',
      eventName: 'storage_gb',
      externalCustomerId: 'globex',
      customerId: '',
      source: '',
      timestamp: null,
      properties: {},
    },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Not matched')).toBeInTheDocument()
    await expect(screen.getByText('No timestamp on this event')).toBeInTheDocument()
  },
}

/**
 * The trace is the reason this sheet exists.
 *
 * Without it the sheet is a payload viewer, and the question people open it
 * with: "why is this not on the invoice?": goes unanswered.
 */
export const Traced: Story = {
  args: { debug: TRACED, onOpenSubscription: fn() },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByText('What happened to this event')).toBeVisible()
    await expect(
      sheet.getByText('Counted: this event added 412 to the customer’s usage.'),
    ).toBeVisible()
    // All five stages, named in billing terms rather than wire terms.
    await expect(sheet.getByText('Customer matched')).toBeVisible()
    await expect(sheet.getByText('Counted towards usage')).toBeVisible()
    // Six: the five stages plus the Ingested row the trace starts from.
    await expect(sheet.getAllByLabelText('Passed')).toHaveLength(6)
  },
}

/** The meter sums a property the event left out: it matched, but adds nothing. */
export const MissingAggregationField: Story = {
  args: {
    debug: {
      ...TRACED,
      stages: TRACED.stages.map((stage) =>
        stage.stage === 'meterMatching'
          ? {
              ...stage,
              raw: {
                status: 'found',
                matched_meters: [
                  {
                    meter_id: 'mtr_1',
                    event_name: 'api_call',
                    meter: { name: 'API Calls', aggregation: { type: 'SUM', field: 'duration_ms' } },
                  },
                ],
              },
            }
          : stage,
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByText('This event has no "duration_ms" property')).toBeVisible()
    await expect(sheet.getByText(/API Calls takes the sum of/)).toBeVisible()
  },
}

/** A failure names the stage, and the stages after it read as not reached. */
export const FailedAtTheMeter: Story = {
  args: { debug: NO_METER },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(
      sheet.getByText('No meter listens for that event name, so nothing measured it.'),
    ).toBeVisible()
    await expect(sheet.getByText('No meter is configured for "api_call".')).toBeVisible()
    await expect(sheet.getAllByLabelText('Failed')).toHaveLength(1)
    // Three skipped, not three more failures: one red row, not four.
    await expect(sheet.getAllByLabelText('Not reached')).toHaveLength(3)
  },
}

/** Where the event was billed: one card per line item it was counted against, as in V1. */
const PROCESSED = toEventDebug({
  status: 'processed',
  event: { id: 'evt_01' },
  events: [
    {
      id: 'evt_01',
      source: 'onboarding',
      ingested_at: '2026-10-20T00:46:41Z',
      timestamp: '2026-10-20T00:46:40Z',
    },
  ],
  processed_events: [
    {
      customer_id: 'cust_01',
      subscription_id: 'subs_01M5297YHKP',
      sub_line_item_id: 'subs_line_01M5299J76',
      price_id: 'price_01M5299J6N0',
      meter_id: 'meter_01M52951BXM',
      feature_id: 'feat_01M5294',
      qty_total: '1',
      processed_at: '2026-10-20T00:46:41Z',
    },
    {
      customer_id: 'cust_01',
      subscription_id: 'subs_01M5297YHKP',
      sub_line_item_id: 'subs_line_01M5297YK3K',
      price_id: 'price_01M52967D4G',
      meter_id: 'meter_01M52951BXM',
      feature_id: 'feat_01M5294',
      qty_total: '1',
      processed_at: '2026-10-20T00:46:41Z',
    },
  ],
  debug_tracker: {
    customer_lookup: {
      status: 'found',
      customer: { id: 'cust_01', external_id: 'dinesh', name: 'Dinesh' },
    },
  },
})

export const ProcessedUsage: Story = {
  args: {
    debug: PROCESSED,
    onOpenSubscription: fn(),
    onOpenFeature: fn(),
    featureNames: { feat_01M5294: 'API calls' },
  },
  play: async ({ canvasElement, args }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByRole('heading', { name: 'Processed usage' })).toBeVisible()
    const first = sheet.getByRole('article', { name: 'Processed usage 1' })
    // A processed event has no stage tracker; the empty trace is not shown.
    await expect(sheet.queryByText('What happened to this event')).toBeNull()
    await expect(sheet.getByText('Billed against 2 contract line items.')).toBeVisible()
    await expect(within(first).getByText('Dinesh')).toBeVisible()
    await expect(within(first).getByText('API calls')).toBeVisible()
    await expect(within(first).getByText('subs_line_01M5299J76')).toBeVisible()
    await expect(within(first).getByText('price_01M5299J6N0')).toBeVisible()
    await expect(sheet.getByRole('article', { name: 'Processed usage 2' })).toBeVisible()
    await userEvent.click(
      within(first).getByRole('button', { name: 'Open contract subs_01M5297YHKP' }),
    )
    await expect(args.onOpenSubscription).toHaveBeenCalledWith('subs_01M5297YHKP')
    await userEvent.click(within(first).getByRole('button', { name: 'Open feature feat_01M5294' }))
    await expect(args.onOpenFeature).toHaveBeenCalledWith('feat_01M5294')
    // One ingestion still lists its version, with both times.
    await expect(sheet.getByRole('heading', { name: 'Ingested versions' })).toBeVisible()
    await expect(sheet.getByText('Version 1')).toBeVisible()
  },
}

/** A replayed event shows every ingestion, which is usually the explanation. */
export const IngestedTwice: Story = {
  args: { debug: TRACED },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByText('Ingested 2 times')).toBeVisible()
    await expect(sheet.getByText('idem_7f2a')).toBeVisible()
  },
}

export const TracePending: Story = {
  args: { debugPending: true },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByLabelText('Loading the trace')).toBeVisible()
  },
}

/** An untraceable event still shows its payload: the sheet is not useless. */
export const TraceFailed: Story = {
  args: {
    debugError: 'This event is outside the window the trace searches.',
    onRetryDebug: fn(),
  },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByText('This event could not be traced')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(sheet.getByText('Properties')).toBeVisible()
  },
}

/**
 * The trace starts where the event landed, and every stage can show its own
 * response.
 *
 * The five stages are things Flexprice did *after* ingestion, so without the
 * Ingested row the list quietly assumes the event arrived: the first thing
 * to confirm when nothing else makes sense. And the readable rows are a
 * summary: the field that explains a given event is often one nobody thought
 * to surface, so the raw response stays one click away.
 */
export const IngestedStepAndRawResponses: Story = {
  args: { debug: TRACED },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body)
    await expect(sheet.getByText('Ingested')).toBeVisible()

    // One disclosure per stage that the tracker actually answered for.
    const responses = sheet.getAllByText('Response')
    await expect(responses.length).toBe(5)

    // The code block is titled with the wire key, which is the useful label
    // when you are reading the response it came from.
    await userEvent.click(responses[0] as HTMLElement)
    await expect(sheet.getByText('customer_lookup')).toBeVisible()
  },
}
