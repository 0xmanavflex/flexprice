import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { MetadataCard } from './MetadataCard'

const meta = {
  title: 'Building blocks/Detail pages/MetadataCard',
  component: MetadataCard,
  parameters: { layout: 'padded' },
  args: {
    metadata: { crm_id: 'acct_4471', segment: 'enterprise' },
    onSave: async () => undefined,
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    metadata: { control: 'object', description: 'String key/value pairs.' },
    onSave: { control: false },
    className: { control: false },
  },
  render: (args) => (
    <div className="max-w-2xl">
      <MetadataCard {...args} />
    </div>
  ),
} satisfies Meta<typeof MetadataCard>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof MetadataCard> & { editable: boolean }

/** Edit the `metadata` JSON (try `{}`), retitle the card, and switch between editable and read-only. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Metadata',
    description: 'Free-form key/value pairs stored with the record.',
    metadata: { crm_id: 'acct_4471', segment: 'enterprise' },
    editable: true,
    onSave: fn(),
  },
  argTypes: {
    editable: { control: 'boolean', description: 'Off omits `onSave`, so the card is read-only.' },
  },
  render: ({ editable, onSave, ...args }) => (
    <div className="max-w-2xl">
      <MetadataCard key={String(editable)} {...args} {...(editable ? { onSave } : {})} />
    </div>
  ),
}

export const Editable: Story = {}
export const ReadOnly: Story = { args: { onSave: undefined as never } }
export const Empty: Story = { args: { metadata: {} } }
