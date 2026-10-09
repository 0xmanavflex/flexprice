import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Input } from '@ui/components/primitives/input'
import { InfoHint } from './InfoHint'

const meta = {
  title: 'Foundation/Compositions/InfoHint',
  component: InfoHint,
  parameters: {
    layout: 'centered',
    // The popover (vendored) is a dialog without an accessible name.
    a11y: {
      config: {
        rules: [
          { id: 'aria-dialog-name', enabled: false },
          { id: 'aria-hidden-focus', enabled: false },
        ],
      },
    },
  },
  args: {
    children:
      'A stable identifier your code uses to refer to this feature. It cannot be changed later.',
  },
  argTypes: {
    children: { control: 'text', description: 'The explanation shown in the popover.' },
  },
} satisfies Meta<typeof InfoHint>

export default meta
type Story = StoryObj<typeof meta>

/** The (i) as it sits beside a field label. */
function BesideLabel({ children, label }: { children: string; label: string }) {
  return (
    <div className="flex w-72 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor="hint-field" className="text-sm font-medium">
          {label}
        </label>
        <InfoHint>{children}</InfoHint>
      </div>
      <Input id="hint-field" defaultValue="api_calls" />
    </div>
  )
}

/** Edit the explanation and the field label; hover or focus the (i) to read it. */
export const Playground: StoryObj<{ children: string; label: string }> = {
  args: {
    children:
      'A stable identifier your code uses to refer to this feature. It cannot be changed later.',
    label: 'Lookup key',
  },
  argTypes: {
    children: { control: 'text' },
    label: { control: 'text' },
  },
  render: ({ children, label }) => <BesideLabel label={label}>{children}</BesideLabel>,
}

/** The bare control: an (i) button named for what it does. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'More information' }),
    ).toBeVisible()
  },
}

/** Hovering the (i) reveals the copy; Escape puts it away again. */
export const RevealsOnHover: Story = {
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More information' })
    await userEvent.hover(trigger)
    const copy = await screen.findByText(args.children)
    await waitFor(() => expect(copy).toBeVisible())
    await userEvent.keyboard('{Escape}')
  },
}

/** Beside a label, the hint must not steal the input's label. */
export const BesideAFieldLabel: Story = {
  render: (args) => <BesideLabel label="Lookup key">{args.children}</BesideLabel>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The button's name does not repeat the field name, so the label still
    // resolves to exactly one control.
    await expect(canvas.getByLabelText('Lookup key')).toHaveValue('api_calls')
    await expect(canvas.getByRole('button', { name: 'More information' })).toBeVisible()
  },
}

/** A long explanation wraps inside the 16rem popover. */
export const LongCopy: Story = {
  args: {
    children:
      'Usage is aggregated per billing period before it is priced. Sum adds every event value together, Count counts events, Unique count counts distinct values of the aggregation field, and Latest keeps only the most recent value. Pick the one that matches how the price is quoted to your customer.',
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: 'More information' }))
    const copy = await screen.findByText(args.children)
    await waitFor(() => expect(copy).toBeVisible())
    await userEvent.keyboard('{Escape}')
  },
}
