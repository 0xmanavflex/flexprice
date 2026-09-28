import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PlanEditorSheet } from './PlanEditorSheet'

/**
 * The plan editor, as a right-hand drawer carrying `PlanForm`. The page owns
 * when it is open and what a submit does; a validated `CreatePlan` comes out.
 * Open by default so the surface is visible. No provider, no network.
 */
const meta = {
  title: 'Surfaces/PlanEditorSheet',
  component: PlanEditorSheet,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof PlanEditorSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement }) => {
    // The drawer renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New plan' })).toBeInTheDocument()
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'Pro', lookupKey: 'pro', description: 'For growing teams' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit plan' })).toBeInTheDocument()
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true, defaultValue: { name: 'Pro', lookupKey: 'pro' } },
}

export const SubmitError: Story = {
  args: {
    submitError: 'A plan with that lookup key already exists.',
    defaultValue: { name: 'Pro', lookupKey: 'pro' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

/** A name is enough; the drawer emits the validated value the form built. */
export const SubmitsFromTheDrawer: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), 'Growth')
    await userEvent.click(screen.getByRole('button', { name: /create plan/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Growth' }))
  },
}
