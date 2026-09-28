import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CouponGrid } from './CouponGrid'
import { couponFixtures, fixtureCouponQuery, manyCoupons } from './couponFixtures'

const meta = {
  title: 'Surfaces/CouponGrid',
  component: CouponGrid,
  parameters: { layout: 'padded' },
  args: {
    coupons: couponFixtures,
    total: couponFixtures.length,
    query: fixtureCouponQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof CouponGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Launch 20% off')).toBeInTheDocument()
    await expect(canvas.getByText('LAUNCH20')).toBeInTheDocument()
    // Percentage and fixed discounts both render.
    await expect(canvas.getByText('20%')).toBeInTheDocument()
    // Unlimited redemptions read as a ceiling, not a blank.
    await expect(canvas.getByText('87 / ∞')).toBeInTheDocument()
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { coupons: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { coupons: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no coupons match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    coupons: [],
    total: 0,
    error: 'You do not have access to coupons in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const PaginationReportsDomainQuery: Story = {
  args: { coupons: manyCoupons(25), total: 120, query: { ...fixtureCouponQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureCouponQuery).sort())
  },
}
