import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { makeCharges } from '../../product-catalog/plans/planDetailFixtures'
import { GroupMembersView, type GroupMember } from './GroupMembersView'

const KINDS = ['Metered feature', 'Static feature', 'Boolean feature', 'Config feature']

function makeMembers(count: number): GroupMember[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `member_${index}`,
    name: `Feature ${String(index + 1).padStart(2, '0')}`,
    detail: KINDS[index % KINDS.length] as string,
  }))
}

interface PlaygroundArgs {
  kind: string
  count: number
}

function MembersPlayground({ kind, count }: PlaygroundArgs) {
  return <GroupMembersView kind={kind} members={makeMembers(count)} />
}

const meta = {
  title: 'App/Settings/Groups/Group members',
  component: GroupMembersView,
  parameters: { layout: 'padded' },
  args: { kind: 'features' },
} satisfies Meta<typeof GroupMembersView>

export default meta
type Story = StoryObj<typeof meta>

/** No member-entities read exists: the tab says so instead of listing sample rows. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading the features in this tag')).toBeInTheDocument()
    await expect(canvas.queryByText('API requests')).toBeNull()
  },
}

/** Real members, once a source exists. */
export const WithMembers: Story = {
  args: { members: makeMembers(3) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Feature 01')).toBeInTheDocument()
  },
}

/** Drag "count" from 0 to 50 to see the empty, short and paged list. */
export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    kind: { control: 'text' },
    count: { control: { type: 'number', min: 0, max: 50, step: 1 } },
  },
  args: { kind: 'features', count: 12 },
  render: (args) => <MembersPlayground {...args} />,
}

/** A group with no members shows the guidance line. */
export const Empty: Story = {
  args: { members: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This tag holds no features yet.'),
    ).toBeInTheDocument()
  },
}

export const Long: Story = {
  args: { members: makeMembers(40) },
}

export const PriceGroup: Story = {
  args: {
    kind: 'charges',
    priceGroup: true,
    members: [
      ...makeCharges(1, 0).map((charge) => ({
        id: charge.id,
        name: 'Platform charge',
        detail: 'Fixed price',
        charge,
      })),
      { id: 'missing-price', name: 'missing-price', detail: 'Not found' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: /^Price$/ })).toBeVisible()
    await expect(canvas.getByText('Unavailable members')).toBeVisible()
    await userEvent.click(canvas.getByText('Platform charge', { exact: true }))
    await waitFor(() => expect(within(document.body).getByRole('dialog')).toBeVisible())
  },
}

export const FailedPriceGroup: Story = {
  args: { kind: 'charges', priceGroup: true, error: 'Could not load tag charges.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Could not load tag charges.')).toBeVisible()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
  },
}
