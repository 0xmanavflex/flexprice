import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { GridToolbar } from '../tables/GridToolbar'
import { PageBody, PageHeader, PageToolbar } from './Page'

/**
 * The shared page skeleton: header, toolbar, body: so no screen invents its
 * own. Layout only. These stories exercise `PageHeader` and compose the whole
 * shape in `FullLayout`.
 */
const meta = {
  title: 'Building blocks/Layout/Page',
  component: PageHeader,
  parameters: { layout: 'padded' },
  args: { title: 'Coupons' },
  argTypes: {
    title: { control: 'text' },
    meta: { control: 'text', description: 'Small inline meta under the title.' },
    action: { control: false },
    actions: { control: false },
    menu: { control: false },
    breadcrumb: { control: false },
  },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Omit<ComponentProps<typeof PageHeader>, 'meta'> & {
  meta: string
  showAction: boolean
  actionLabel: string
}

/** Retitle the page, add meta text, and show or relabel the primary action. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Coupons',
    meta: '42 coupons · synced just now',
    showAction: true,
    actionLabel: 'New coupon',
  },
  argTypes: {
    showAction: { control: 'boolean' },
    actionLabel: { control: 'text' },
  },
  render: ({ showAction, actionLabel, meta, ...args }) => (
    <PageHeader
      {...args}
      {...(meta ? { meta } : {})}
      {...(showAction ? { action: <Button>{actionLabel}</Button> } : {})}
    />
  ),
}

export const Header: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { level: 1, name: 'Coupons' }),
    ).toBeInTheDocument()
  },
}

/** The one thing this page is for: a single action, not a row of them. */
export const WithAction: Story = {
  args: {
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
      <PageHeader title="Coupons" action={<Button>New coupon</Button>} />
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
