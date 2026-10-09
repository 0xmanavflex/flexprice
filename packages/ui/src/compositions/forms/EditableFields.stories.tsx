import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { EditableFields, type EditableFieldDef } from './EditableFields'

const DEFAULT_FIELDS: EditableFieldDef[] = [
  { key: 'name', label: 'Name', value: 'Pro API Calls', required: true },
  { key: 'description', label: 'Description', value: 'API usage', multiline: true },
]

interface HarnessProps {
  onSave: (changes: Record<string, string>) => void
  /** The field definitions; edit the JSON to add, drop, require or lock fields. */
  fields?: readonly EditableFieldDef[]
  /** Start with every field already an input, as if Edit had been pressed. */
  startEditing?: boolean
}

function Harness({ onSave, fields = DEFAULT_FIELDS, startEditing = false }: HarnessProps) {
  const [editing, setEditing] = useState(startEditing)
  useEffect(() => setEditing(startEditing), [startEditing])
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <EditableFields
        fields={fields}
        editing={editing}
        onEditingChange={setEditing}
        onSave={onSave}
      />
    </div>
  )
}

const meta = {
  title: 'Compositions/EditableFields',
  component: Harness,
  args: { onSave: fn() },
  argTypes: {
    fields: { control: 'object' },
    startEditing: { control: 'boolean' },
    onSave: { control: false },
  },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

/** Edit the `fields` JSON (add a field, mark one `readOnly` or `required`) and toggle `startEditing`; saves report only the changed keys. */
export const Playground: Story = {
  args: {
    startEditing: false,
    fields: [
      ...DEFAULT_FIELDS,
      { key: 'lookup_key', label: 'Lookup key', value: 'pro_api_calls', readOnly: true },
    ],
  },
}

/** A field's own pencil edits that value alone and saves only that key. */
export const SingleFieldPencil: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }))
    const input = canvas.getByLabelText('Name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Pro{Enter}')
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Pro' })
  },
}

/** The header Edit turns every field into an input with one Save. */
export const HeaderEditAll: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(canvas.getByLabelText('Name'))
    await userEvent.type(canvas.getByLabelText('Name'), 'Pro')
    await userEvent.type(canvas.getByLabelText('Description'), ' per month')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      name: 'Pro',
      description: 'API usage per month',
    })
  },
}

export const ValidationBlocksSave: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(canvas.getByLabelText('Name'))
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByText('Name is required.')).toBeInTheDocument()
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

export const CancelKeepsValues: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await userEvent.type(canvas.getByLabelText('Name'), ' x')
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(canvas.getByText('Pro API Calls')).toBeInTheDocument()
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}
