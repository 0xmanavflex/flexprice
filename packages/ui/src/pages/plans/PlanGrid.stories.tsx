import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { PlanGrid } from './PlanGrid'
import { fixturePlanQuery, manyPlans, planFixtures } from './planFixtures'

/**
 * Wait for an open popup to finish unmounting.
 *
 * While a Base UI popup is open it mounts `data-base-ui-focus-guard` spans
 * that are `aria-hidden` *and* `tabindex="0"` — which is exactly what axe's
 * `aria-hidden-focus` rule forbids. The a11y scan runs when the play function
 * returns, so a story that returns while the popup is still closing is scanned
 * mid-animation and fails intermittently. This is not a suppression: it makes
 * the scan look at the settled DOM, which is the state being asserted about.
 */
async function popupClosed(role: 'menu' | 'listbox') {
  await waitFor(() => expect(within(document.body).queryByRole(role)).toBeNull())
}

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

    await expect(await canvas.findByText('Starter')).toBeInTheDocument()

    // The headline price carries its period the way a pricing page writes it,
    // from BILLING_PERIOD_SHORT — never a string this side invents.
    // The amount and the muted period are separate spans, as in the redesign.
    await expect(canvas.getByText('$29').textContent).toBe('$29 / mo')
    await expect(canvas.getByText('$499').textContent).toBe('$499 / yr')
    // An unrecognised period falls back to the bare amount rather than
    // printing the raw enum at someone.
    await expect(canvas.getByText('Custom')).toBeInTheDocument()

    // A plan that prices nothing says so, rather than rendering blank.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
  },
}

/**
 * The columns the API cannot fill are absent, not dashed.
 *
 * Subscribers and Trial have no field on `PlanWire`, so there is no header for
 * them. This is the assertion that stops someone "helpfully" adding the column
 * back with a placeholder.
 */
export const OmitsUnsourcedColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Starter')

    await expect(canvas.queryByRole('columnheader', { name: /subscribers/i })).toBeNull()
    await expect(canvas.queryByRole('columnheader', { name: /trial/i })).toBeNull()
    // What the API can give is here.
    await expect(canvas.getByRole('columnheader', { name: /charges/i })).toBeInTheDocument()
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Starter')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

/** The row menu offers only what the page actually wired. */
export const RowActions: Story = {
  args: { onPlanClick: fn(), onArchive: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Starter')

    const triggers = canvas.getAllByRole('button', { name: 'Row actions' })
    await userEvent.click(triggers[0] as HTMLElement)

    const menu = within(await within(document.body).findByRole('menu'))
    await expect(menu.getByText(/view plan/i)).toBeInTheDocument()
    // Not passed, so not offered — a menu item that does nothing is worse
    // than one that is absent.
    await expect(menu.queryByText(/duplicate plan/i)).toBeNull()

    await userEvent.click(menu.getByText(/archive plan/i))
    await waitFor(() => expect(args.onArchive).toHaveBeenCalled())
    await popupClosed('menu')
  },
}

export const Loading: Story = { args: { plans: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    plans: [],
    total: 0,
    query: { ...fixturePlanQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no plans match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing created yet: the illustration, the CTA, and three guide cards. */
export const FirstRun: Story = {
  args: { plans: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No plans yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
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

/** Paging reports a page number, never an offset, and never drops a query key. */
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
