import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@ui/components/primitives/input'
import { LabelWithHint } from './LabelWithHint'

const meta = {
  title: 'Building blocks/Forms/LabelWithHint',
  component: LabelWithHint,
  parameters: { layout: 'padded' },
  args: {
    htmlFor: 'lookup-key',
    hint: 'Stable identifier the API uses. Lowercase letters, numbers and underscores.',
    children: 'Lookup key',
  },
  argTypes: {
    hint: { control: 'text', description: 'Revealed behind the (i) beside the label.' },
    children: { control: 'text', description: 'The label text.' },
    htmlFor: { control: false },
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

/** Edit the label and hint text; hover or focus the (i) to read the hint. */
export const Playground: Story = {
  args: { children: 'Lookup key', hint: 'Stable identifier the API uses.' },
}

export const Default: Story = {}
