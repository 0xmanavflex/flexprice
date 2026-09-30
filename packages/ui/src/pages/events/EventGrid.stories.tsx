import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { DEFAULT_RAW_EVENT_QUERY, type RawEvent } from '@fp/domain'
import { EventGrid } from './EventGrid'

const events: RawEvent[] = [
  {
    id: 'evt_01',
    eventName: 'api_call',
    externalCustomerId: 'acme-corp',
    customerId: 'cust_01',
    source: 'sdk',
    timestamp: new Date('2026-09-01T10:15:30Z'),
    properties: { endpoint: '/v1/search', tokens: 412 },
  },
  {
    // Never matched to a Flexprice customer, and no source: both render as dashes.
    id: 'evt_02',
    eventName: 'storage_gb',
    externalCustomerId: 'globex',
    customerId: '',
    source: '',
    timestamp: new Date('2026-09-01T09:00:00Z'),
    properties: {},
  },
]

const meta = {
  title: 'Surfaces/EventGrid',
  component: EventGrid,
  parameters: { layout: 'padded' },
  args: {
    events,
    total: 2,
    query: { ...DEFAULT_RAW_EVENT_QUERY },
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof EventGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('api_call')).toBeInTheDocument()
    await expect(canvas.getByText('acme-corp')).toBeInTheDocument()
    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).toContain('event id')
  },
}

export const Loading: Story = { args: { events: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { events: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No events received yet')).toBeInTheDocument()
  },
}

export const FilteredEmpty: Story = {
  args: { events: [], total: 0, query: { ...DEFAULT_RAW_EVENT_QUERY, customer: 'nobody' }, onClearFilters: fn() },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No events match these filters'),
    ).toBeInTheDocument()
  },
}

export const Failed: Story = {
  args: { events: [], total: 0, error: 'Could not reach Flexprice.', onRetry: fn() },
}
