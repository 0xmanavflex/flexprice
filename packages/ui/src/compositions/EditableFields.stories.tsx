import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { EditableFields, type EditableFieldDef } from './EditableFields'

const fields: EditableFieldDef[] = [
  { key: 'name', label: 'Name', value: 'Pro API Calls', required: true },
  { key: 'description', label: 'Description', value: 'API usage', multiline: true },
]

function Harness({ onSave }: { onSave: (changes: Record<string, string>) => void }) {
  const [editing, setEditing] = useState(false)
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
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

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
