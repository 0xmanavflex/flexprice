import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { RotateCcwIcon } from '@ui/icons'
import { Pill } from '@ui/pages/shared/cells'
import { FileDropzone, FileRow, formatFileSize } from './FileDropzone'

/**
 * One file in: drop it or browse for it. The chosen file goes out through
 * `onSelect`; nothing here keeps it, which is why every state below is just
 * props.
 */
const meta = {
  title: 'Building blocks/Forms/FileDropzone',
  component: FileDropzone,
  args: {
    title: 'Drop a contract to begin',
    hint: 'PDF, PNG or JPG · up to 20 MB',
    accept: '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg',
    maxSize: 20 * 1024 * 1024,
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileDropzone>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Disabled: Story = { args: { disabled: true } }

/** A message from outside, such as the server refusing the file, sits under the area. */
export const WithError: Story = {
  args: { error: 'Unsupported file type. Upload a PDF, PNG or JPG.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Unsupported file type')
  },
}

/** Picking an accepted file hands it to `onSelect`. */
export const SelectsAFile: Story = {
  play: async ({ canvasElement, args }) => {
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['%PDF-1.7'], 'msa.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)
    await expect(args.onSelect).toHaveBeenCalledWith(file)
  },
}

/** A file over `maxSize` is refused here, with a reason, and never reaches `onSelect`. */
export const RefusesALargeFile: Story = {
  args: { maxSize: 4 },
  play: async ({ canvasElement, args }) => {
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['%PDF-1.7 too big'], 'big.pdf', { type: 'application/pdf' }))
    await expect(args.onSelect).not.toHaveBeenCalled()
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('maximum size')
  },
}

/** The row that stands for a chosen file, in its usual states. */
export const Rows: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <FileRow
        name="Gobblecube MSA.pdf"
        detail={`${formatFileSize(482113)} · Uploading`}
        status={<Spinner />}
      />
      <FileRow
        name="Gobblecube MSA.pdf"
        detail="41 terms from 13 pages · 3 to check"
        status={<Pill tone="success">Terms found</Pill>}
        actions={
          <Button variant="outline" size="sm" className="h-7 px-2.5">
            <RotateCcwIcon aria-hidden /> Replace
          </Button>
        }
      />
    </div>
  ),
}
