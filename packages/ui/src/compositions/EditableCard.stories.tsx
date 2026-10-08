import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { EditableCard, type EditableCardProps } from './EditableCard'
import type { EditableFieldDef } from './EditableFields'

type PlaygroundArgs = EditableCardProps & {
  /** What happens when Save is pressed. */
  saveOutcome: 'success' | 'error'
  /** Include the display-only id field. */
  showReadOnlyField: boolean
  /** Include the always-read-only content below the fields. */
  showFooterContent: boolean
}

const BASE_FIELDS: EditableFieldDef[] = [
  { key: 'id', label: 'ID', value: 'plan_01HZX3K8', readOnly: true },
  { key: 'name', label: 'Name', value: 'Growth', required: true },
  {
    key: 'email',
    label: 'Billing email',
    value: 'billing@acme.example',
    validate: (next) => (next === '' || next.includes('@') ? null : 'Enter a valid email.'),
  },
  {
    key: 'description',
    label: 'Description',
    value: 'For teams past their first thousand customers.',
    multiline: true,
    placeholder: 'No description',
  },
]

function EditableCardDemo({
  saveOutcome,
  showReadOnlyField,
  showFooterContent,
  onSave,
  ...props
}: PlaygroundArgs) {
  const [saved, setSaved] = useState<Record<string, string>>({})
  useEffect(() => setSaved({}), [saveOutcome])
  const fields = BASE_FIELDS.filter((field) => showReadOnlyField || !field.readOnly).map(
    (field) => ({ ...field, value: saved[field.key] ?? field.value }),
  )
  return (
    <div className="max-w-3xl">
      <EditableCard
        {...props}
        fields={fields}
        onSave={async (changes) => {
          await onSave(changes)
          if (saveOutcome === 'error') throw new Error('The server rejected this change.')
          setSaved((current) => ({ ...current, ...changes }))
        }}
      >
        {showFooterContent ? (
          <p className="text-muted-foreground text-xs">
            Changes apply from the next billing cycle.
          </p>
        ) : null}
      </EditableCard>
    </div>
  )
}

const meta = {
  title: 'Foundation/Compositions/EditableCard',
  component: EditableCard,
  parameters: {
    layout: 'padded',
    // Edit mode puts labels and inputs straight inside the card's <dl>; the card is a composition we do not change here.
    a11y: { config: { rules: [{ id: 'definition-list', enabled: false }] } },
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    locked: { control: 'boolean' },
    className: { control: 'text' },
    saveOutcome: { control: 'inline-radio', options: ['success', 'error'] },
    showReadOnlyField: { control: 'boolean' },
    showFooterContent: { control: 'boolean' },
    fields: { control: false },
    children: { control: false },
    onSave: { control: false },
  },
  args: {
    title: 'Plan details',
    description: 'Basic information about this plan.',
    locked: false,
    saveOutcome: 'success',
    showReadOnlyField: true,
    showFooterContent: false,
    fields: [],
    onSave: fn(),
  },
  render: (args) => <EditableCardDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Press the pencil, edit, save; choose whether the save succeeds or the server rejects it. */
export const Playground: Story = {}

/** Display mode: values as text, a pencil in the header. */
export const Viewing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Growth')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Edit plan details' })).toBeVisible()
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
  },
}

/** An archived record: no pencil, so nothing can be edited. */
export const Locked: Story = {
  args: { locked: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('button', { name: 'Edit plan details' }),
    ).not.toBeInTheDocument()
  },
}

/** The pencil flips the fields to inputs; the read-only id stays text. */
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit plan details' }))
    await expect(await canvas.findByLabelText('Name')).toHaveValue('Growth')
    await expect(canvas.getByLabelText('Description')).toBeVisible()
    await expect(canvas.queryByLabelText('ID')).not.toBeInTheDocument()
    await expect(canvas.getByText('plan_01HZX3K8')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeVisible()
  },
}

/** Saving reports only the changed keys and returns to display mode with the new value. */
export const SavesChanges: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit plan details' }))
    const name = await canvas.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Scale')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith({ name: 'Scale' }))
    await expect(await canvas.findByText('Scale')).toBeVisible()
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
  },
}

/** Cancel discards the draft and restores the original value. */
export const CancelDiscards: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit plan details' }))
    await userEvent.type(await canvas.findByLabelText('Name'), ' Plus')
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(await canvas.findByText('Growth')).toBeVisible()
  },
}

/** A required field left empty and a bad email each show their own announced error; nothing is saved. */
export const ValidationErrors: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit plan details' }))
    await userEvent.clear(await canvas.findByLabelText('Name'))
    const email = canvas.getByLabelText('Billing email')
    await userEvent.clear(email)
    await userEvent.type(email, 'not-an-email')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Name is required.')).toBeVisible()
    await expect(canvas.getByText('Enter a valid email.')).toBeVisible()
    await expect(canvas.getAllByRole('alert')).toHaveLength(2)
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** The server rejects the change: its message shows under the fields and the card stays in edit mode. */
export const SaveFails: Story = {
  args: { saveOutcome: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit plan details' }))
    await userEvent.type(await canvas.findByLabelText('Name'), ' Plus')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('The server rejected this change.')).toBeVisible()
    await expect(canvas.getByLabelText('Name')).toHaveValue('Growth Plus')
  },
}

/** Always-read-only content sits under the fields in both modes. */
export const WithFooterContent: Story = {
  args: { showFooterContent: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Changes apply from the next billing cycle.'),
    ).toBeVisible()
  },
}
