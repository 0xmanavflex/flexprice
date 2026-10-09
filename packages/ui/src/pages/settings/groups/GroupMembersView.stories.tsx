import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DEMO_GROUP_MEMBERS, GroupMembersView, type GroupMember } from './GroupMembersView'

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

/** The default demo rows the console shows today. */
export const Default: Story = {
  args: { members: DEMO_GROUP_MEMBERS },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('API requests')).toBeInTheDocument()
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
      within(canvasElement).getByText('This group holds no features yet.'),
    ).toBeInTheDocument()
  },
}

export const Long: Story = {
  args: { members: makeMembers(40) },
}
