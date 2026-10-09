import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { CloneFeature, Feature } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { FeatureCloneDialog } from './FeatureCloneDialog'
import { featureFixtures } from './featureFixtures'

const SOURCES = ['none', ...featureFixtures.map((feature) => feature.name)]

function sourceByName(name: string): Feature | null {
  return featureFixtures.find((feature) => feature.name === name) ?? null
}

interface HarnessProps {
  open: boolean
  sourceName: string
  isSubmitting: boolean
  submitError: string
  onSubmit: (draft: CloneFeature) => void
}

/** Owns `open` so the dialog closes and re-opens; follows the control when it changes. */
function FeatureCloneDialogHarness({
  open: initialOpen,
  sourceName,
  isSubmitting,
  submitError,
  onSubmit,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen)
  useEffect(() => setOpen(initialOpen), [initialOpen])
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open clone dialog
      </Button>
      <FeatureCloneDialog
        open={open}
        onOpenChange={setOpen}
        source={sourceByName(sourceName)}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError || null}
      />
    </div>
  )
}

/** The dialog portals to the document, so the play functions read from `screen`. */
const meta = {
  title: 'App/Product catalog/Products/Clone product dialog',
  component: FeatureCloneDialogHarness,
  parameters: { layout: 'padded' },
  argTypes: {
    open: { control: 'boolean' },
    sourceName: { control: 'select', options: SOURCES },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    onSubmit: { control: false },
  },
  args: {
    open: true,
    sourceName: 'API calls',
    isSubmitting: false,
    submitError: '',
    onSubmit: fn(),
  },
} satisfies Meta<typeof FeatureCloneDialogHarness>

export default meta
type Story = StoryObj<typeof meta>

const openDialog = () => screen.findByRole('dialog', { name: 'Clone product' })

/** Pick the source feature, flip submitting, set a server error, or close and re-open. */
export const Playground: Story = {}

/** The copy name and lookup key are derived from the source. */
export const Default: Story = {
  play: async () => {
    const dialog = await openDialog()
    await expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toHaveValue(
      'API calls (copy)',
    )
    await expect(within(dialog).getByRole('textbox', { name: /^Lookup key/ })).toHaveValue(
      'feat-api-calls-copy',
    )
  },
}

/** Submitting sends the copy's name, key and description. */
export const Submits: Story = {
  play: async ({ args }) => {
    const dialog = await openDialog()
    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.type(name, 'API calls EU')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create copy' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'API calls EU' })),
    )
  },
}

/** A cleared name is rejected by the domain schema. */
export const RequiresAName: Story = {
  play: async ({ args }) => {
    const dialog = await openDialog()
    await userEvent.clear(within(dialog).getByRole('textbox', { name: /^Name/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create copy' }))
    await expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Fields and actions lock while the copy is being created. */
export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async () => {
    const dialog = await openDialog()
    await expect(within(dialog).getByRole('textbox', { name: /^Name/ })).toBeDisabled()
    await expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled()
  },
}

/** A server rejection shows above the actions. */
export const WithError: Story = {
  args: { submitError: 'That lookup key is already in use.' },
  play: async () => {
    const dialog = await openDialog()
    await expect(within(dialog).getByText('That lookup key is already in use.')).toBeInTheDocument()
  },
}

/** Closed: only the trigger shows, and clicking it opens the dialog. */
export const OpensFromTrigger: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open clone dialog' }))
    await expect(await openDialog()).toBeInTheDocument()
  },
}

/** No source selected: the dialog opens empty. */
export const NoSource: Story = {
  args: { sourceName: 'none' },
}
