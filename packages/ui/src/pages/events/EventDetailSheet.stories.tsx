import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { EventDetailSheet } from './EventDetailSheet'

const meta = {
  title: 'Surfaces/EventDetailSheet',
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
