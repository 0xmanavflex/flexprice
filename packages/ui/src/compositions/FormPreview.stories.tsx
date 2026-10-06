import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { FormPreview, PreviewAmount, PreviewRow, PreviewRows, PreviewSection } from './FormPreview'

/**
 * The live preview rail beside a form (the solution-billing-8 rail): heading
 * with a badge, a dashed headline figure, titled sections of label/value rows.
 * Props in, markup out; each form feeds it from its own draft.
 */
const meta = {
  title: 'Foundation/Compositions/Form preview',
  component: FormPreview,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Rail: Story = {
  args: {
    title: 'Subscription summary',
    description: 'Updates as you fill in each step.',
    badge: <Badge>Draft</Badge>,
    children: (
      <>
        <PreviewAmount label="Per month" value="$29.00" hint="Billed in advance" />
        <PreviewSection title="Billing">
          <PreviewRows>
            <PreviewRow label="Cycle" value="Monthly" />
            <PreviewRow label="Starts" value="Now" />
            <PreviewRow label="Total" value="$29.00" strong />
          </PreviewRows>
        </PreviewSection>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('complementary', { name: 'Subscription summary' })).toBeVisible()
    await expect(canvas.getByText('Monthly')).toBeVisible()
  },
}
