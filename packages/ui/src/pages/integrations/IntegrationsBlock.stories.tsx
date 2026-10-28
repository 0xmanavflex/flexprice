import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration, type IntegrationConnection } from '@fp/domain'
import { IntegrationsBlock } from './IntegrationsBlock'

function connection(providerType: string): IntegrationConnection {
  return {
    id: `conn_${providerType}`,
    name: providerType,
    providerType,
    syncConfig: {},
    metadata: {},
    billingEntityId: null,
  }
}

/** The first `count` catalogue entries (cycled past the catalogue's end); the first `connected` are connected. */
function makeIntegrations(count: number, connected: number): Integration[] {
  return Array.from({ length: count }, (_, index) => {
    const spec = INTEGRATION_CATALOG[index % INTEGRATION_CATALOG.length]!
    const lap = Math.floor(index / INTEGRATION_CATALOG.length)
    return {
      ...spec,
      id: lap === 0 ? spec.id : `${spec.id}_${lap}`,
      name: lap === 0 ? spec.name : `${spec.name} ${lap + 1}`,
      connections: index < connected ? [connection(spec.providerType)] : [],
    }
  })
}

/** The integrations gallery: search, category filter, and Connected / Available sections. */
const meta = {
  title: 'App/Integrations/Integrations',
  component: IntegrationsBlock,
  parameters: { layout: 'fullscreen' },
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

/** No catalogue at all is the first-run state, not a filtered miss. */
export const Empty: Story = {
  args: { integrations: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nothing connected yet')).toBeInTheDocument()
    await expect(canvas.queryByText(/match these filters/)).toBeNull()
  },
}

/** The first request: card-shaped placeholders, announced once. */
export const Loading: Story = {
  args: { integrations: [], isLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Loading integrations',
    )
  },
}

/** A failed request says why and offers a retry; a permission error would not. */
export const LoadError: Story = {
  args: {
    integrations: [],
    error: { message: 'Could not reach Flexprice.', canRetry: true, kind: 'network' },
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Could not reach Flexprice.')
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const Forbidden: Story = {
  args: {
    integrations: [],
    error: {
      message: 'Your role does not include access to integrations.',
      canRetry: false,
      kind: 'denied',
    },
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /try again/i })).toBeNull()
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
    await expect(canvas.getByText(/No results for/)).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }))
    await expect(canvas.getByRole('heading', { name: 'Razorpay' })).toBeInTheDocument()
  },
}

/** Connect hands the integration to the page, which opens the connect sheet. */
export const ConnectsAnIntegration: Story = {
  args: {
    integrations: makeIntegrations(INTEGRATION_CATALOG.length, 0),
    onConnect: fn(),
    onConfigure: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Connect Stripe' }))
    await expect(args.onConnect).toHaveBeenCalledWith(expect.objectContaining({ id: 'stripe' }))
    await expect(canvas.queryByRole('heading', { name: 'Connected' })).toBeNull()
  },
}

/** Configure on a connected card hands it to the page, which opens the manage sheet. */
export const ConfiguresAConnection: Story = {
  args: { onConnect: fn(), onConfigure: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const [configure] = canvas.getAllByRole('button', { name: /^Configure / })
    await userEvent.click(configure!)
    await expect(args.onConfigure).toHaveBeenCalledOnce()
  },
}
