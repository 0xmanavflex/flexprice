import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Input } from '@ui/components/primitives/input'
import { Field } from './Field'

const meta = {
  title: 'Building blocks/Forms/Field',
  component: Field,
  parameters: { layout: 'padded' },
  args: {
    label: 'Lookup key',
    children: (props) => <Input {...props} />,
  },
  argTypes: {
    label: { control: 'text' },
    hint: {
      control: 'text',
      description: 'Shown behind an (i); always in the DOM for screen readers.',
    },
    error: { control: 'text', description: 'Any text switches the field into its error state.' },
    required: { control: 'boolean' },
    children: { control: false },
  },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

/** Type a hint, an error, or tick required: the label, hint and error stay wired to the input. */
export const Playground: Story = {
  args: {
    label: 'Lookup key',
    hint: 'Lowercase letters, numbers and underscores.',
    error: '',
    required: false,
  },
}

export const Default: Story = {}

export const WithHint: Story = {
  args: { hint: 'Lowercase letters, numbers and underscores.' },
}

export const Required: Story = { args: { required: true } }

/**
 * The wiring is the whole component, so it is what gets asserted.
 *
 * `aria-describedby` must reach *both* the hint and the error: the common bug
 * is that adding an error silently replaces the hint for screen reader users.
 */
export const WiresLabelHintAndError: Story = {
  args: {
    hint: 'Lowercase letters, numbers and underscores.',
    error: 'Use lowercase letters, numbers and underscores',
    required: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText(/lookup key/i)

    await expect(input).toBeRequired()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(describedBy).toHaveLength(2)

    const described = describedBy.map((id) => canvasElement.querySelector(`#${id}`)?.textContent)
    expect(described).toContain('Lowercase letters, numbers and underscores.')
    expect(described).toContain('Use lowercase letters, numbers and underscores')

    await expect(canvas.getByRole('alert')).toBeInTheDocument()
  },
}
