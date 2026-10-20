import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DataExportDialog } from './ExportForms'

const meta = {
  title: 'App/Developers/Exports/New export dialog',
  component: DataExportDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    connectionId: 'conn_s3_01',
    flexpriceManaged: false,
    onSubmit: fn(async () => undefined),
  },
} satisfies Meta<typeof DataExportDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Your own bucket: bucket and region are required; the draft goes to the page. */
export const OwnBucket: Story = {
  play: async ({ args }) => {
    const dialog = within(document.body)
    await userEvent.click(dialog.getByRole('button', { name: 'Create export' }))
    await expect(await dialog.findByText('Enter the bucket name')).toBeVisible()
    await userEvent.type(dialog.getByLabelText(/^Bucket/), 'acme-billing')
    await userEvent.click(dialog.getByRole('button', { name: 'Create export' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'conn_s3_01', bucket: 'acme-billing' }),
      ),
    )
  },
}

/** A managed bucket: Flexprice picks the bucket, so it is not asked for. */
export const FlexpriceManaged: Story = {
  args: { flexpriceManaged: true },
  play: async () => {
    const dialog = within(document.body)
    await expect(dialog.getByText('Flexprice-managed bucket')).toBeVisible()
    await expect(dialog.queryByLabelText(/^Bucket/)).toBeNull()
  },
}
