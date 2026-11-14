import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SplitWorkspace } from './SplitWorkspace'

/**
 * The source document on the left, the step on the right. Actions live in the
 * `FormToolbar` above it, so the frame itself is only the two panes.
 */
const meta = {
  title: 'Building blocks/Layout/SplitWorkspace',
  component: SplitWorkspace,
  parameters: { layout: 'fullscreen' },
  args: {
    documentLabel: 'Contract',
    title: 'Upload a contract',
    description:
      'Start by adding the agreement. Flexprice AI reads it and fills in every step for you to confirm.',
    document: (
      <p className="text-muted-foreground m-auto max-w-xs p-6 text-center text-sm">
        The document shows here.
      </p>
    ),
    children: <p className="text-sm">The step’s controls go here.</p>,
  },
  decorators: [
    (Story) => (
      <div className="flex h-[36rem] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Upload a contract' })).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Contract' })).toBeInTheDocument()
  },
}

export const WithDocumentHeader: Story = {
  args: {
    documentHeader: <p className="text-[13px] font-medium">Gobblecube MSA.pdf</p>,
  },
}
