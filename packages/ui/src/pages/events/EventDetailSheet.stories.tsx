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
} satisfies Meta<typeof EventDetailSheet>

export default meta
type Story = StoryObj<typeof meta>

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
