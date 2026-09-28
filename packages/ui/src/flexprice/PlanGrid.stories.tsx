import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { PlanGrid } from './PlanGrid'
import { fixturePlanQuery, manyPlans, planFixtures } from './planFixtures'

const meta = {
  title: 'Surfaces/PlanGrid',
  component: PlanGrid,
  parameters: { layout: 'padded' },
  args: {
    plans: planFixtures,
    total: planFixtures.length,
    query: fixturePlanQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof PlanGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Pro')).toBeInTheDocument()
    await expect(canvas.getByText('plan_pro')).toBeInTheDocument()
    // Published and Archived both render.
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
    // A plan with no charges says so rather than rendering a bare 0.
    await expect(canvas.getByText(/no charges/i)).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { plans: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { plans: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no plans match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    plans: [],
    total: 0,
    error: 'You do not have access to plans in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Paging reports a page number, never an offset. */
export const PaginationReportsDomainQuery: Story = {
  args: { plans: manyPlans(25), total: 120, query: { ...fixturePlanQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    // The grid can also fire onQueryChange as it settles, so the Next click is
    // not necessarily call[0]. Wait for — then read — the call that reported
    // page 2, rather than racing whichever call landed first.
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixturePlanQuery).sort())
  },
}
