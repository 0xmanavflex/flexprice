import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { FeatureEditorDialog } from './FeatureEditorDialog'
import { featureFixtures } from './featureFixtures'

/**
 * The feature editor, as a large centred dialog — the list stays visible behind
 * it. Presentational: the page owns open/close, the mode and what a submit does.
 */
const meta = {
  title: 'Surfaces/FeatureEditorDialog',
  component: FeatureEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof FeatureEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Opens, validates, and submits a boolean feature. */
export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    // The dialog renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('dialog', { name: 'New feature' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create feature/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/^Name/), 'API calls')
    await userEvent.type(screen.getByLabelText(/^Event name/), 'api_call')
    await userEvent.click(screen.getByRole('button', { name: /create feature/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'API calls', type: FeatureType.Metered }),
    )
  },
}

/** Editing an existing feature: seeded, with the lookup key and meter read-only. */
export const Edit: Story = {
  args: { mode: 'edit', feature: featureFixtures[0]! } as never,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('dialog', { name: 'Edit feature' })).toBeInTheDocument()
    await expect(screen.getByLabelText(/^Name/)).toHaveValue('API calls')
    await expect(screen.getByLabelText(/^Lookup key/)).toHaveAttribute('readonly')
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A feature with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}
