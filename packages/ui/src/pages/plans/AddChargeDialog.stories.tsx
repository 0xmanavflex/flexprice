import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { PriceType } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { AddChargeDialog } from './AddChargeDialog'
import { fixtureMeters, makeCharge } from './planDetailFixtures'

interface PlaygroundProps {
  open: boolean
  /** `create` asks Fixed or Usage first; `edit` opens the form on an existing charge. */
  mode: 'create' | 'edit'
  /** The type of the charge being edited. */
  editingType: PriceType
  isSubmitting: boolean
  submitError: string
  meterCount: number
  withPriceUnits: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: unknown) => void
}

/** Controlled wrapper: the `open` control drives the dialog, and the trigger and close button drive it back. */
function DialogPlayground({
  open,
  mode,
  editingType,
  isSubmitting,
  submitError,
  meterCount,
  withPriceUnits,
  onOpenChange,
  onSubmit,
}: PlaygroundProps) {
  const [isOpen, setIsOpen] = useState(open)
  useEffect(() => setIsOpen(open), [open])
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Open charge dialog
      </Button>
      <AddChargeDialog
        open={isOpen}
        onOpenChange={(next) => {
          setIsOpen(next)
          onOpenChange(next)
        }}
        editing={mode === 'edit' ? makeCharge(0, { type: editingType }) : null}
        meters={fixtureMeters.slice(0, meterCount)}
        priceUnits={withPriceUnits ? [{ code: 'TOK', name: 'Tokens', baseCurrency: 'USD' }] : []}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError || null}
      />
    </>
  )
}

/**
 * "Add charge": choose Fixed or Usage, then the charge form. Editing skips the choice.
 * Submitting disables the form, so it stands in for a disabled state.
 */
const meta = {
  title: 'Surfaces/AddChargeDialog',
  component: DialogPlayground,
  parameters: {
    layout: 'centered',
    // The dialog embeds ChargeForm, which carries the same documented exemptions in its own stories.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: false },
          { id: 'button-name', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
        ],
      },
    },
  },
  args: {
    open: true,
    mode: 'create',
    editingType: PriceType.Fixed,
    isSubmitting: false,
    submitError: '',
    meterCount: 2,
    withPriceUnits: false,
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  argTypes: {
    open: { control: 'boolean' },
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    editingType: { control: 'inline-radio', options: Object.values(PriceType) },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    meterCount: { control: { type: 'number', min: 0, max: 3, step: 1 } },
    withPriceUnits: { control: 'boolean' },
    onOpenChange: { control: false },
    onSubmit: { control: false },
  },
} satisfies Meta<typeof DialogPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Create opens on the Fixed or Usage choice; Continue reveals the form. */
export const ChoosesAType: Story = {
  play: async ({ args }) => {
    await waitFor(async () => expect(await screen.findByText('Add charge')).toBeVisible())
    await userEvent.click(screen.getByRole('radio', { name: /Usage/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull())
    await expect(await screen.findByText('Metered feature')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Cancel on the choice step closes the dialog. */
export const CancelsFromTheChoice: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Add charge')).toBeNull())
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
  },
}

/** The dialog starts closed and the trigger opens it. */
export const OpensFromTrigger: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    await expect(screen.queryByText('Add charge')).toBeNull()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open charge dialog' }))
    await expect(await screen.findByText('Add charge')).toBeVisible()
  },
}

/** Editing goes straight to the form, titled "Edit charge". */
export const EditFixed: Story = {
  args: { mode: 'edit', editingType: PriceType.Fixed },
  play: async () => {
    await expect(await screen.findByText('Edit charge')).toBeVisible()
    await expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  },
}

export const EditUsage: Story = {
  args: { mode: 'edit', editingType: PriceType.Usage },
}

export const Submitting: Story = {
  args: { mode: 'edit', isSubmitting: true },
}

export const SubmitError: Story = {
  args: { mode: 'edit', submitError: 'That charge could not be saved. Try again.' },
  play: async () => {
    await expect(
      await screen.findByText('That charge could not be saved. Try again.'),
    ).toBeVisible()
  },
}
