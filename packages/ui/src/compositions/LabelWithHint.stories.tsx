import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@ui/components/primitives/input'
import { LabelWithHint } from './LabelWithHint'

const meta = {
  title: 'Foundation/Compositions/LabelWithHint',
  component: LabelWithHint,
  parameters: { layout: 'padded' },
  args: {
    htmlFor: 'lookup-key',
    hint: 'Stable identifier the API uses. Lowercase letters, numbers and underscores.',
    children: 'Lookup key',
  },
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <LabelWithHint {...args} />
      <Input id="lookup-key" />
    </div>
  ),
} satisfies Meta<typeof LabelWithHint>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
