import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { InvoiceLinesEditor, type EditableLine } from './InvoiceLinesEditor'

const LINES: EditableLine[] = [
  { id: 'li_1', displayName: 'Onboarding', amount: '250.00', quantity: '1' },
  { id: 'li_2', displayName: 'Seats', amount: '12.00', quantity: '20' },
]

/** Drives the editor as the page does, so the stories exercise real edits. */
function Harness({
  initial = LINES,
  onChange,
  ...rest
}: {
  initial?: EditableLine[]
  onChange?: (lines: EditableLine[]) => void
  disabled?: boolean
  readOnlyReason?: string | null
}) {
  const [lines, setLines] = useState<EditableLine[]>(initial)
  return (
    <div className="max-w-2xl p-6">
      <InvoiceLinesEditor
        lines={lines}
        onChange={(next) => {
          setLines(next)
          onChange?.(next)
        }}
        {...rest}
      />
    </div>
  )
}

const meta = {
  title: 'App/Billing/Invoice lines editor',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  args: { onChange: fn() },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByDisplayValue('Onboarding')).toBeVisible()
    await expect(canvas.getByDisplayValue('Seats')).toBeVisible()
  },
}

/** Editing a line reports the whole set back, so the page can diff it. */
export const EditsALine: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const amount = canvas.getByDisplayValue('250.00')
    await userEvent.clear(amount)
    await userEvent.type(amount, '300')
    await expect(args.onChange).toHaveBeenCalled()
    await expect(canvas.getByDisplayValue('300')).toBeVisible()
  },
}

/** A removed row leaves immediately; the page turns it into a remove call. */
export const RemovesALine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Onboarding' }))
    await expect(canvas.queryByDisplayValue('Onboarding')).toBeNull()
    await expect(canvas.getByDisplayValue('Seats')).toBeVisible()
  },
}

/** A new row starts blank at quantity 1: the common case, and a valid one. */
export const AddsALine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add line' }))
    const quantities = canvas.getAllByDisplayValue('1')
    await expect(quantities.length).toBeGreaterThan(0)
  },
}

/** An invoice with nothing on it says so, rather than showing an empty table. */
export const Empty: Story = {
  args: { initial: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/no lines/i)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add line' })).toBeVisible()
  },
}

/**
 * Not a draft.
 *
 * The API would modify a finalized invoice, but doing so voids it and
 * replaces it with a draft copy under a new id. Nobody types into an amount
 * field expecting that, so the editor is withheld and the reason is given.
 */
export const FinalizedIsReadOnly: Story = {
  args: {
    readOnlyReason:
      'Lines can only be edited while an invoice is a draft. Editing a finalized invoice voids it and replaces it with a draft copy.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/only be edited while an invoice is a draft/i)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Add line' })).toBeNull()
    await expect(canvas.queryByDisplayValue('Onboarding')).toBeNull()
  },
}

/** While a save is in flight nothing can be changed underneath it. */
export const Saving: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Add line' })).toBeDisabled()
    await expect(canvas.getByDisplayValue('Onboarding')).toBeDisabled()
  },
}
