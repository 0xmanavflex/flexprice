import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toaster } from 'sonner'
import { expect, userEvent, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { IntegrationsBlock } from './IntegrationsBlock'

/** The first `count` catalogue entries (cycled past the catalogue's end); the first `connected` are connected. */
function makeIntegrations(count: number, connected: number): Integration[] {
  return Array.from({ length: count }, (_, index) => {
    const spec = INTEGRATION_CATALOG[index % INTEGRATION_CATALOG.length]!
    const lap = Math.floor(index / INTEGRATION_CATALOG.length)
    return {
      ...spec,
      id: lap === 0 ? spec.id : `${spec.id}_${lap}`,
      name: lap === 0 ? spec.name : `${spec.name} ${lap + 1}`,
      connections: index < connected ? 1 : 0,
    }
  })
}

/** The integrations gallery: search, category filter, and Connected / Available sections. */
const meta = {
  title: 'App/Integrations/Integrations',
  component: IntegrationsBlock,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
  args: { integrations: makeIntegrations(INTEGRATION_CATALOG.length, 2) },
} satisfies Meta<typeof IntegrationsBlock>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  total: number
  connected: number
}

/** Drag "total" from 0 to 48 and "connected" to see the empty, normal and long gallery. */
export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    total: { control: { type: 'number', min: 0, max: 48, step: 1 } },
    connected: { control: { type: 'number', min: 0, max: 48, step: 1 } },
  },
  args: { total: INTEGRATION_CATALOG.length, connected: 2 },
  render: ({ total, connected }) => (
    <IntegrationsBlock integrations={makeIntegrations(total, connected)} />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Connected' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Available' })).toBeInTheDocument()
    // Premium entries are not self-serve, so the gallery leaves them out.
    await expect(canvas.queryByText('Salesforce')).toBeNull()
  },
}

/** Nothing connected: no Connected section. */
export const NoneConnected: Story = {
  args: { integrations: makeIntegrations(INTEGRATION_CATALOG.length, 0) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('heading', { name: 'Connected' })).toBeNull()
  },
}

export const AllConnected: Story = {
  args: { integrations: makeIntegrations(INTEGRATION_CATALOG.length, INTEGRATION_CATALOG.length) },
}

export const Empty: Story = {
  args: { integrations: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No integrations match these filters.'),
    ).toBeInTheDocument()
  },
}

export const ManyIntegrations: Story = {
  args: { integrations: makeIntegrations(40, 6) },
}

/** Search narrows the gallery; a miss shows the empty line, and Clear restores it. */
export const SearchFilters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search integrations' })
    await userEvent.type(search, 'stripe')
    await expect(canvas.getByRole('heading', { name: 'Stripe' })).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { name: 'Razorpay' })).toBeNull()
    await userEvent.clear(search)
    await userEvent.type(search, 'zzz-no-such-app')
    await expect(canvas.getByText('No integrations match these filters.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }))
    await expect(canvas.getByRole('heading', { name: 'Razorpay' })).toBeInTheDocument()
  },
}

/** Connecting is local state: the card moves to Connected. */
export const ConnectsAnIntegration: Story = {
  args: { integrations: makeIntegrations(INTEGRATION_CATALOG.length, 0) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'Stripe enabled' }))
    await expect(await canvas.findByRole('heading', { name: 'Connected' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  },
}
