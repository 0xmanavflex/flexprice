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
  argTypes: {
    title: { control: 'text' },
    summary: { control: 'text', description: 'What is inside, shown on the closed row.' },
    defaultOpen: { control: 'boolean', description: 'Initial state (remounts on change).' },
    forceOpen: {
      control: 'boolean',
      description: 'Forces open, e.g. a hidden field failed; never forces closed.',
    },
    children: { control: false },
    className: { control: false },
  },
  render: (args) => (
    <div className="max-w-2xl">
      {/* `defaultOpen` is read once, so key on it for the control to take effect. */}
      <FormDisclosure key={String(args.defaultOpen)} {...args} />
    </div>
  ),
} satisfies Meta<typeof FormDisclosure>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop as a control: toggle `defaultOpen`, or `forceOpen` to see a failed hidden field reveal the section. */
export const Playground: Story = {
  args: { defaultOpen: false, forceOpen: false },
}

export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
