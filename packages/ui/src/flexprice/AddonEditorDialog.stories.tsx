import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { AddonEditorDialog } from './AddonEditorDialog'

/**
 * The add-on editor, as a right-hand drawer — the list stays visible behind it.
 * Presentational: it owns the form's field values; the page owns open/close,
 * the mode, and what a submit does. Open by default so the surface is visible.
 */
const meta = {
  title: 'Surfaces/AddonEditorDialog',
  component: AddonEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof AddonEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Creating a new add-on. */
export const Create: Story = {
  play: async ({ canvasElement }) => {
    // The drawer renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('New add-on')).toBeInTheDocument()
  },
}

/** Editing an existing add-on — the form is seeded, the lookup key locked. */
export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: {
      name: 'Priority support',
      lookupKey: 'priority_support',
      description: 'Faster response times and a named contact',
    },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Edit add-on')).toBeInTheDocument()
  },
}

export const Submitting: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'Priority support', lookupKey: 'priority_support' },
    isSubmitting: true,
  },
}

export const SubmitError: Story = {
  args: {
    defaultValue: { name: 'Priority support', lookupKey: 'priority_support' },
    submitError: 'An add-on with that lookup key already exists.',
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}
