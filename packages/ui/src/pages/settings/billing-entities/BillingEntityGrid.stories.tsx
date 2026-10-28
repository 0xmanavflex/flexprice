import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BillingEntitiesEnableCard } from './BillingEntitiesEnableCard'
import { BillingEntityGrid } from './BillingEntityGrid'
import { billingEntityFixtures } from './billingEntityFixtures'

const meta = {
  title: 'App/Settings/Billing entities/Billing entity table',
  component: BillingEntityGrid,
  parameters: { layout: 'padded' },
  args: {
    rows: billingEntityFixtures(),
    total: 3,
    page: 1,
    pageSize: 25,
    onPaginationChange: fn(),
    search: '',
    onSearchChange: fn(),
    onCreate: fn(),
    onOpen: fn(),
  },
} satisfies Meta<typeof BillingEntityGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Acme Inc')).toBeInTheDocument()
    await expect(canvas.getAllByText('Default')).toHaveLength(1)
    await expect(canvas.getByText('ACME-DE')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'New entity' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const Empty: Story = {
  args: { rows: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No billing entities yet'),
    ).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { rows: [], total: 0, isLoading: true } }

export const Error: Story = {
  args: { rows: [], total: 0, error: 'Could not load billing entities.', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const EnableCard: StoryObj<typeof BillingEntitiesEnableCard> = {
  render: (args) => <BillingEntitiesEnableCard {...args} />,
  args: { environmentName: 'Sandbox', canEnable: true, isEnabling: false, onEnable: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Enable billing entities' }))
    await expect(args.onEnable).toHaveBeenCalled()
  },
}

export const EnableCardNotSuperAdmin: StoryObj<typeof BillingEntitiesEnableCard> = {
  render: (args) => <BillingEntitiesEnableCard {...args} />,
  args: { environmentName: 'Sandbox', canEnable: false, isEnabling: false, onEnable: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('button', { name: 'Enable billing entities' }),
    ).toBeDisabled()
    await expect(
      canvas.getByText('Only super admins can enable billing entities.'),
    ).toBeInTheDocument()
  },
}

export const EnableCardEnabling: StoryObj<typeof BillingEntitiesEnableCard> = {
  render: (args) => <BillingEntitiesEnableCard {...args} />,
  args: { environmentName: 'Sandbox', canEnable: true, isEnabling: true, onEnable: fn() },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Enabling billing entities in Sandbox…'),
    ).toBeInTheDocument()
  },
}
