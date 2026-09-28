import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { GridToolbar } from './GridToolbar'
import { PageBody, PageHeader, PageToolbar } from './Page'

/**
 * The shared page skeleton — header, toolbar, body — so no screen invents its
 * own. Layout only. These stories exercise `PageHeader` and compose the whole
 * shape in `FullLayout`.
 */
const meta = {
  title: 'Foundation/Compositions/Page',
  component: PageHeader,
  parameters: { layout: 'padded' },
  args: { title: 'Coupons' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Header: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { level: 1, name: 'Coupons' }),
    ).toBeInTheDocument()
  },
}

/** The one thing this page is for — a single action, not a row of them. */
export const WithDescriptionAndAction: Story = {
  args: {
    description: 'Discounts you can apply to a subscription or an invoice.',
    action: <Button>New coupon</Button>,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'New coupon' })).toBeVisible()
  },
}

/** Header, toolbar and body stacked, the arrangement a list screen uses. */
export const FullLayout: Story = {
  render: () => (
    <div className="flex flex-col rounded-lg border">
      <PageHeader
        title="Coupons"
        description="Discounts you can apply to a subscription or an invoice."
        action={<Button>New coupon</Button>}
      />
      <PageToolbar>
        <GridToolbar search="" onSearchChange={() => {}} label="Search coupons" />
      </PageToolbar>
      <PageBody>
        <div className="text-muted-foreground rounded-lg border p-6 text-sm">The list.</div>
      </PageBody>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Coupons' })).toBeInTheDocument()
    await expect(canvas.getByText('The list.')).toBeVisible()
  },
}
