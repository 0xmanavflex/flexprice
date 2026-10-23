import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { RelatedCard } from '@ui/compositions/detail/RelatedCard'
import { ContractIntegrations } from './ContractIntegrations'

const meta = {
  title: 'App/Contracts/Contract integrations',
  component: ContractIntegrations,
  args: { layout: 'rows', links: [], linkable: [] },
  render: (args) => (
    <div className="w-80">
      <RelatedCard items={[]}>
        <ContractIntegrations {...args} />
      </RelatedCard>
    </div>
  ),
} satisfies Meta<typeof ContractIntegrations>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing linked and nothing to link: the Related card says so instead of standing empty. */
export const NothingLinked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No integrations linked to this customer.')).toBeVisible()
  },
}

/** Nothing linked yet, but a connected provider can be linked. */
export const NothingLinkedYet: Story = {
  args: {
    linkable: [{ providerType: 'stripe', name: 'Stripe' }],
    onLink: fn(async () => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No integrations linked to this customer.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Link integration' })).toBeVisible()
  },
}

/** A linked provider is a row, with no empty line. */
export const Linked: Story = {
  args: {
    links: [
      {
        id: 'conn_stripe',
        mappingId: 'map_1',
        name: 'Stripe',
        providerType: 'stripe',
        providerEntityId: 'cus_Q2a9xYz',
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Manage Stripe integration' })).toBeVisible()
    await expect(canvas.queryByText('No integrations linked to this customer.')).toBeNull()
  },
}
