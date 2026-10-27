import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_PLAN_QUERY, type PlanQuery, PlanStatus } from '@fp/domain'
import { PlanGrid, type PlanLinkage } from './PlanGrid'
import { fixturePlanQuery, manyPlans, planFixtures } from './planFixtures'

/**
 * What each fixture plan contains. `plan_05` is deliberately absent: a plan
 * the linkage has not answered for yet renders a placeholder, never a zero.
 */
const linkage = new Map<string, PlanLinkage>([
  ['plan_01', { entitlements: 6, creditGrants: 2, contracts: 6 }],
  ['plan_02', { entitlements: 10, creditGrants: 2, contracts: 2 }],
  ['plan_03', { entitlements: 6, creditGrants: 1, contracts: 8 }],
  ['plan_04', { entitlements: 0, creditGrants: 0, contracts: 3 }],
])

/**
 * Wait for an open popup to finish unmounting.
 *
 * While a Base UI popup is open it mounts `data-base-ui-focus-guard` spans
 * that are `aria-hidden` *and* `tabindex="0"`: which is exactly what axe's
 * `aria-hidden-focus` rule forbids. The a11y scan runs when the play function
 * returns, so a story that returns while the popup is still closing is scanned
 * mid-animation and fails intermittently. This is not a suppression: it makes
 * the scan look at the settled DOM, which is the state being asserted about.
 */
async function popupClosed(role: 'menu' | 'listbox') {
  await waitFor(() => expect(within(document.body).queryByRole(role)).toBeNull())
}

const meta = {
  title: 'App/Product catalog/Plans/Plan table',
  component: PlanGrid,
  parameters: { layout: 'padded' },
  args: {
    plans: planFixtures,
    linkage,
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

    // Type is read off the charge mix, not stored: all four shapes are here.
    // Two fixtures are flat-rate, hence getAllByText for that one.
    await expect(canvas.getAllByText('Flat-rate').length).toBe(2)
    await expect(canvas.getByText('Hybrid')).toBeInTheDocument()
    await expect(canvas.getByText('Usage-based')).toBeInTheDocument()
    await expect(canvas.getByText('No charges yet')).toBeInTheDocument()

    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
  },
}

/**
 * A count nobody could read is blank, not zero.
 *
 * `plan_05` has no linkage entry and the grid is not loading, so its three
 * count cells show an em dash: a fourth comes from its empty lookup key.
 * "We could not find out" and "there are none" must not render the same,
 * which is why `plan_04`: which *is* answered for, with zeroes: shows them.
 */
export const ZeroReadsAsADash: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Legacy Team has no charges, no entitlements and no grants, and three
    // contracts still on it. The noughts are dashes; the three is a three.
    const legacy = (await canvas.findByText('Legacy Team')).closest('tr') as HTMLElement
    await expect(within(legacy).getAllByText('—').length).toBe(3)
    await expect(within(legacy).getByText('3')).toBeInTheDocument()

    // Enterprise has no linkage entry at all. Unknown reads the same as none
    //: the grid does not draw that distinction: plus one for its empty
    // lookup key.
    const enterprise = (canvas.getByText('Enterprise').closest('tr') as HTMLElement) ?? null
    await expect(within(enterprise).getAllByText('—').length).toBe(4)
  },
}

/**
 * The default column set is the redesign's, in its order.
 *
 * Trial has no field on `PlanWire`, so there is no header for it: this is the
 * assertion that stops someone "helpfully" adding the column back with a
 * placeholder. Base price, Updated and Created are real but off by default;
 * `BasePriceStaysReachable` proves they did not simply disappear.
 */
export const DefaultColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Starter')

    const headers = canvas
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter((text): text is string => Boolean(text))
    await expect(headers.slice(0, 8)).toEqual([
      'Plan',
      'Type',
      'Charges',
      'Entitlements',
      'Credit grants',
      'Contracts',
      'Status',
      'Lookup key',
    ])

    await expect(canvas.queryByRole('columnheader', { name: /trial/i })).toBeNull()
    await expect(canvas.queryByRole('columnheader', { name: /base price/i })).toBeNull()
  },
}

/** Off by default is not gone: the `⋯` menu still offers it. */
export const BasePriceStaysReachable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Starter')

    await userEvent.click(canvas.getByRole('button', { name: 'Table options' }))
    const menu = within(await within(document.body).findByRole('menu'))
    await userEvent.click(await menu.findByText('Base price'))
    await userEvent.keyboard('{Escape}')
    await popupClosed('menu')

    // The headline price carries its period the way a pricing page writes it,
    // from BILLING_PERIOD_SHORT: never a string this side invents.
    await expect(canvas.getByText('$29').textContent).toBe('$29 / mo')
    // An unrecognised period falls back to the bare amount rather than
    // printing the raw enum at someone.
    await expect(canvas.getByText('Custom')).toBeInTheDocument()
    // A usage-only plan has no flat price: it names what it meters instead of
    // showing its first usage rate as a base price.
    await expect(canvas.getByText('Usage-based · API calls')).toBeInTheDocument()
    await expect(canvas.queryByText(/\$0\.002/)).toBeNull()
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
    // Not passed, so not offered: a menu item that does nothing is worse
    // than one that is absent.
    await expect(menu.queryByText(/duplicate plan/i)).toBeNull()

    await userEvent.click(menu.getByText(/archive plan/i))
    await waitFor(() => expect(args.onArchive).toHaveBeenCalled())
    await popupClosed('menu')
  },
}

export const Loading: Story = { args: { plans: [], total: 0, isLoading: true } }

/** A filter emptied the list: the toolbar survives, so it can be undone. */
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
    // not necessarily call[0]. Wait for: then read: the call that reported
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

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof PlanGrid>,
  'plans' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | PlanStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function PlanGridPlayground({ rows, page, pageSize, status, hasError, ...rest }: PlaygroundArgs) {
  const [query, setQuery] = useState<PlanQuery>({ ...DEFAULT_PLAN_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyPlans(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <PlanGrid
      locale="en-US"
      {...rest}
      plans={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to plans in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(plans|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onPlanClick: fn(),
    onEdit: fn(),
    onDuplicate: fn(),
    onAddCharges: fn(),
    onArchive: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(PlanStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <PlanGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

/**
 * The count columns are centred.
 *
 * `cells.tsx` says everything is left-aligned, and for amounts it is right:
 * a figure an arm's length from its row helps nobody. A column that is
 * *only* a count is the exception the handoff calls out: there is no label
 * beside the number for the eye to start from, so a one-digit figure under a
 * wider header reads as adrift. Name and Status stay left.
 */
export const CountColumnsAreCentred: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const starter = (await canvas.findByText('Starter')).closest('tr') as HTMLElement
    const cells = Array.from(starter.querySelectorAll('td'))
    const headers = canvas
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim() ?? '')

    const centred = ['Charges', 'Entitlements', 'Credit grants', 'Contracts']
    for (const name of centred) {
      const cell = cells[headers.indexOf(name)] as HTMLElement
      await expect(getComputedStyle(cell).textAlign).toBe('center')
    }
    // And the columns that are not counts are untouched.
    const plan = cells[headers.indexOf('Plan')] as HTMLElement
    await expect(getComputedStyle(plan).textAlign).not.toBe('center')
  },
}
