import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { InlineField, type InlineFieldProps } from './InlineField'

const meta = {
  title: 'Foundation/Compositions/InlineField',
  component: InlineField,
  parameters: { layout: 'padded' },
  args: {
    label: 'Name',
    value: 'Acme Robotics',
    onSave: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    placeholder: { control: 'text' },
    multiline: { control: 'boolean' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    display: { control: false },
    onSave: { control: false },
    validate: { control: false },
    className: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineField>

export default meta
type Story = StoryObj<typeof meta>

type StatefulArgs = InlineFieldProps & { failSave?: boolean; neverResolves?: boolean }

/**
 * Holds the value like the page's query would: Save calls `onSave`, then the
 * new value comes back in as a prop.
 */
function Stateful({ value: initial, onSave, failSave, neverResolves, ...props }: StatefulArgs) {
  const [value, setValue] = useState(initial)
  return (
    <InlineField
      {...props}
      value={value}
      onSave={async (next) => {
        await onSave(next)
        if (neverResolves) await new Promise<never>(() => {})
        if (failSave) throw new Error('The server rejected this change.')
        setValue(next)
      }}
    />
  )
}

const stateful = (args: StatefulArgs) => <Stateful {...args} />

/** Every prop as a control; "failSave" makes the next Save reject so the inline error shows. */
export const Playground: StoryObj<StatefulArgs> = {
  args: {
    label: 'Name',
    value: 'Acme Robotics',
    placeholder: 'Not set',
    multiline: false,
    required: false,
    readOnly: false,
    failSave: false,
    onSave: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    placeholder: { control: 'text' },
    multiline: { control: 'boolean' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    failSave: { control: 'boolean' },
    neverResolves: { control: 'boolean', description: 'Hold the save pending forever.' },
    onSave: { control: false },
  },
  render: stateful,
}

/** The read state: the value and an Edit affordance named for the field. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Acme Robotics')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Edit Name' })).toBeVisible()
  },
}

/** Edit, type, Save: the new value is shown and `onSave` heard it. */
export const EditAndSave: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', onSave: fn() },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    const input = canvas.getByLabelText('Name')
    await expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.type(input, 'Globex')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(canvas.getByText('Globex')).toBeVisible())
    await expect(args.onSave).toHaveBeenCalledWith('Globex')
  },
}

/** Enter saves from the keyboard. */
export const EnterSaves: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', onSave: fn() },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    const input = canvas.getByLabelText('Name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Initech{Enter}')
    await waitFor(() => expect(canvas.getByText('Initech')).toBeVisible())
    await expect(args.onSave).toHaveBeenCalledWith('Initech')
  },
}

/** Escape abandons the draft and keeps the stored value. */
export const EscapeCancels: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', onSave: fn() },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    await userEvent.type(canvas.getByLabelText('Name'), ' Ltd{Escape}')
    await expect(canvas.getByText('Acme Robotics')).toBeVisible()
    await expect(canvas.queryByLabelText('Name')).not.toBeInTheDocument()
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** Saving an unchanged value just closes the editor. */
export const UnchangedDoesNotSave: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', onSave: fn() },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(canvas.getByRole('button', { name: 'Edit Name' })).toBeVisible()
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** A required field refuses to save empty and says why. */
export const RequiredBlocksEmpty: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', required: true, onSave: fn() },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    await userEvent.clear(canvas.getByLabelText('Name'))
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Name is required.')
    await expect(canvas.getByLabelText('Name')).toBeInvalid()
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** `validate` can veto a save with its own message. */
export const ValidationBlocks: StoryObj<StatefulArgs> = {
  args: {
    label: 'Lookup key',
    value: 'api_calls',
    onSave: fn(),
    validate: (next) => (/\s/.test(next) ? 'Lookup keys cannot contain spaces.' : null),
  },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Lookup key' }))
    const input = canvas.getByLabelText('Lookup key')
    await userEvent.clear(input)
    await userEvent.type(input, 'api calls')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Lookup keys cannot contain spaces.')
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** A rejected save keeps the editor open and shows the error inline. */
export const SaveFails: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', failSave: true, onSave: fn() },
  render: stateful,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    const input = canvas.getByLabelText('Name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Globex')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The server rejected this change.',
    )
    await expect(canvas.getByLabelText('Name')).toHaveValue('Globex')
  },
}

/** While the save is in flight the field is disabled and Save says so. */
export const Saving: StoryObj<StatefulArgs> = {
  args: { label: 'Name', value: 'Acme Robotics', neverResolves: true, onSave: fn() },
  render: stateful,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    const input = canvas.getByLabelText('Name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Globex')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(input).toBeDisabled()
  },
}

/** Multiline: Enter adds a line, Cmd/Ctrl+Enter saves. */
export const Multiline: StoryObj<StatefulArgs> = {
  args: {
    label: 'Description',
    value: 'Meters API calls per month.',
    multiline: true,
    onSave: fn(),
  },
  render: stateful,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Description' }))
    const area = canvas.getByLabelText('Description')
    await userEvent.type(area, '{Enter}Billed in arrears.')
    await expect(area).toHaveValue('Meters API calls per month.\nBilled in arrears.')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(args.onSave).toHaveBeenCalled())
  },
}

/** No value: the placeholder stands in. */
export const EmptyValue: Story = {
  args: { value: '', placeholder: 'Not set' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Not set')).toBeVisible()
  },
}

/** `display` swaps the read state for any node while editing still uses the text. */
export const CustomDisplay: Story = {
  args: {
    label: 'Status page',
    value: 'https://status.acme.test',
    display: (
      <a className="underline" href="https://status.acme.test">
        status.acme.test
      </a>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: 'status.acme.test' }),
    ).toBeVisible()
  },
}

/** Read-only (e.g. an archived record): no edit affordance at all. */
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Acme Robotics')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Edit Name' })).not.toBeInTheDocument()
  },
}
