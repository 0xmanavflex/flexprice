import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@ui/components/primitives/input'
import { FormDisclosure } from './FormDisclosure'

const meta = {
  title: 'Foundation/Compositions/FormDisclosure',
  component: FormDisclosure,
  parameters: { layout: 'padded' },
  args: {
    title: 'More details',
    summary: 'Phone, billing address and timezone. All optional.',
    children: <Input aria-label="Phone" placeholder="+1 555 0100" />,
  },
  render: (args) => (
    <div className="max-w-2xl">
      <FormDisclosure {...args} />
    </div>
  ),
} satisfies Meta<typeof FormDisclosure>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
