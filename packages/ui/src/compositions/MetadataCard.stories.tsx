import type { Meta, StoryObj } from '@storybook/react-vite'
import { MetadataCard } from './MetadataCard'

const meta = {
  title: 'Foundation/Compositions/MetadataCard',
  component: MetadataCard,
  parameters: { layout: 'padded' },
  args: {
    metadata: { crm_id: 'acct_4471', segment: 'enterprise' },
    onSave: async () => undefined,
  },
  render: (args) => (
    <div className="max-w-2xl">
      <MetadataCard {...args} />
    </div>
  ),
} satisfies Meta<typeof MetadataCard>

export default meta
type Story = StoryObj<typeof meta>

export const Editable: Story = {}
export const ReadOnly: Story = { args: { onSave: undefined as never } }
export const Empty: Story = { args: { metadata: {} } }
