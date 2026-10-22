import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenIcon, EyeIcon, RocketIcon, WrenchIcon } from '@ui/icons'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { money } from '@fp/domain'
import { createFilterQuery } from '@ui/components/reui/filters/filters-query'
import { Button } from '@ui/components/primitives/button'
import { EntityList, type EntityListProps } from './EntityList'
import { dateColumn, idColumn, moneyColumn, numberColumn, pillColumn, textColumn } from './cells'

interface Widget {
  id: string
  name: string
  lookup: string
  status: 'published' | 'archived'
  amount: ReturnType<typeof money>
  seats: number
  created: Date
  updated: Date
}

function widgets(count: number): Widget[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `wid_${String(index + 1).padStart(3, '0')}`,
    name: ['API calls', 'Seats', 'Storage', 'SSO', 'Audit log'][index % 5] + ` ${index + 1}`,
    lookup: `widget_${index + 1}`,
    status: index % 3 === 0 ? ('archived' as const) : ('published' as const),
    amount: money(`${(index + 1) * 12}.50`, 'USD'),
    seats: (index + 1) * 25,
    created: new Date(2026, 0, (index % 27) + 1),
    updated: new Date(2026, 3, (index % 27) + 1),
  }))
}

const COLUMNS = [
  textColumn<Widget>('name', 'Widget', (row) => row.name, {
    width: 240,
    sortable: true,
    hideable: false,
  }),
  pillColumn<Widget>('status', 'Status', (row) => ({
    label: row.status === 'published' ? 'Published' : 'Archived',
    tone: row.status === 'published' ? 'success' : 'neutral',
  })),
  idColumn<Widget>('lookup', 'Lookup key', (row) => row.lookup),
  moneyColumn<Widget>('amount', 'Amount', (row) => row.amount, { locale: 'en-US' }),
  numberColumn<Widget>('seats', 'Seats', (row) => row.seats, { locale: 'en-US' }),
  dateColumn<Widget>('created', 'Created', (row) => row.created, {
    locale: 'en-US',
    sortable: true,
  }),
  dateColumn<Widget>('updated', 'Updated', (row) => row.updated, { locale: 'en-US' }),
]

/**
 * The one list table.
 *
 * These stories are the layout's test suite. The numbers in `Layout` below —
 * 44, 60, 40, 288 — are the design, and they are asserted here rather than
 * eyeballed because every one of them drifted at least once across the twelve
 * hand-built grids this replaces.
 */
/*
 * Typed against the concrete row rather than `typeof EntityList`.
 *
 * Storybook resolves a generic component's props by instantiating its type
 * parameter, which lands on `object` — and then `EntityColumn<Widget>[]` no
 * longer fits `EntityColumn<object>[]`, because the column's `cell` takes the
 * row. Naming the instantiation once here keeps every story's args honest.
 */
type WidgetList = EntityListProps<Widget>
const WidgetEntityList = EntityList<Widget>

const meta = {
  title: 'Building blocks/Tables & lists/EntityList',
  component: WidgetEntityList,
  parameters: { layout: 'padded' },
  args: {
    label: 'Widgets',
    noun: 'widgets',
    rows: widgets(8),
    total: 8,
    columns: COLUMNS,
    getRowId: (row: Widget) => row.id,
    page: 1,
    pageSize: 25,
    onPaginationChange: fn(),
    search: '',
    onSearchChange: fn(),
  },
} satisfies Meta<WidgetList>

export default meta
type Story = StoryObj<WidgetList>

interface PlaygroundArgs {
  rowCount: number
  pageSize: number
  noun: string
  isLoading: boolean
  hasError: boolean
  showFirstRunEmpty: boolean
  showRowActions: boolean
  clickableRows: boolean
  showSort: boolean
  showExport: boolean
  compact: boolean
  hideToolbar: boolean
  onRowClick: () => void
  onRowAction: () => void
  onRetry: () => void
}

/** A client-side harness around the real table: search, sort and paging all work against `rowCount` fixture rows. */
function PlaygroundList({
  rowCount,
  pageSize: initialPageSize,
  noun,
  isLoading,
  hasError,
  showFirstRunEmpty,
  showRowActions,
  clickableRows,
  showSort,
  showExport,
  compact,
  hideToolbar,
  onRowClick,
  onRowAction,
  onRetry,
}: PlaygroundArgs) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created',
    direction: 'asc',
  })

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const all = widgets(rowCount).filter(
      (row) => !needle || `${row.name} ${row.lookup}`.toLowerCase().includes(needle),
    )
    const sign = sort.direction === 'asc' ? 1 : -1
    return [...all].sort((a, b) =>
      sort.field === 'name'
        ? sign * a.name.localeCompare(b.name)
        : sign * (a.created.getTime() - b.created.getTime()),
    )
  }, [rowCount, search, sort])

  const start = (page - 1) * pageSize
  const rows = matches.slice(start, start + pageSize)

  return (
    <WidgetEntityList
      label="Widgets"
      noun={noun}
      columns={COLUMNS}
      getRowId={(row) => row.id}
      rows={isLoading || hasError ? [] : rows}
      total={isLoading || hasError ? 0 : matches.length}
      page={page}
      pageSize={pageSize}
      onPaginationChange={(nextPage, nextSize) => {
        setPage(nextPage)
        setPageSize(nextSize)
      }}
      search={search}
      onSearchChange={(value) => {
        setSearch(value)
        setPage(1)
      }}
      isLoading={isLoading}
      error={hasError ? 'Could not reach Flexprice.' : null}
      onRetry={onRetry}
      isFiltered={search.trim().length > 0}
      onClearFilters={() => setSearch('')}
      compact={compact}
      hideToolbar={hideToolbar}
      {...(showFirstRunEmpty
        ? {
            empty: {
              title: `No ${noun} yet`,
              description: 'Create one to start measuring.',
              actions: <Button>New widget</Button>,
            },
          }
        : {})}
      {...(showRowActions
        ? {
            rowActions: () => [
              { label: 'Open', icon: <EyeIcon aria-hidden />, onSelect: onRowAction },
            ],
          }
        : {})}
      {...(clickableRows ? { onRowClick } : {})}
      {...(showExport ? { exportFileName: 'widgets' } : {})}
      {...(showSort
        ? {
            sort: {
              options: [
                { value: 'name', label: 'Name' },
                { value: 'created', label: 'Created' },
              ],
              field: sort.field,
              direction: sort.direction,
              onChange: (field: string, direction: 'asc' | 'desc') => {
                setSort({ field, direction })
                setPage(1)
              },
            },
          }
        : {})}
    />
  )
}

/** Drag rowCount from 0 (first-run empty state) to 120; loading, error, selection, row actions, sort and paging are all live. */
export const Playground = {
  args: {
    rowCount: 42,
    pageSize: 10,
    noun: 'widgets',
    isLoading: false,
    hasError: false,
    showFirstRunEmpty: true,
    showRowActions: true,
    clickableRows: false,
    showSort: true,
    showExport: true,
    compact: false,
    hideToolbar: false,
    onRowClick: fn(),
    onRowAction: fn(),
    onRetry: fn(),
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 120, step: 1 } },
    pageSize: { control: 'select', options: [5, 10, 25, 50] },
    noun: { control: 'text' },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    showFirstRunEmpty: { control: 'boolean', description: 'Custom empty copy when rowCount is 0.' },
    showRowActions: { control: 'boolean' },
    clickableRows: { control: 'boolean' },
    showSort: { control: 'boolean' },
    showExport: { control: 'boolean' },
    compact: { control: 'boolean' },
    hideToolbar: { control: 'boolean' },
    onRowClick: { control: false },
    onRowAction: { control: false },
    onRetry: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'rowCount',
        'pageSize',
        'noun',
        'isLoading',
        'hasError',
        'showFirstRunEmpty',
        'showRowActions',
        'clickableRows',
        'showSort',
        'showExport',
        'compact',
        'hideToolbar',
        'onRowClick',
        'onRowAction',
        'onRetry',
      ],
    },
  },
  render: (args) => <PlaygroundList {...args} />,
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('API calls 1')).toBeInTheDocument()
    await expect(canvas.getByText('1 - 8 of 8 widgets')).toBeInTheDocument()
  },
}

/**
 * The measurements, asserted.
 *
 * Header 44px, rows 60px, 16px of padding a side, the search box 288px. The
 * header carries no rule beneath it and the last row carries none under it —
 * the two borders that make a table look like a spreadsheet.
 */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls 1')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)
    const headerStyle = getComputedStyle(header)
    await expect(headerStyle.paddingLeft).toBe('16px')
    // No line under the band.
    await expect(headerStyle.borderBottomWidth).toBe('0px')

    const rows = canvasElement.querySelectorAll('tbody tr')
    const firstCell = rows[0]!.querySelector('td') as HTMLElement
    await expect(Math.round(firstCell.getBoundingClientRect().height)).toBe(60)
    const cellStyle = getComputedStyle(firstCell)
    await expect(cellStyle.paddingLeft).toBe('16px')
    await expect(cellStyle.paddingRight).toBe('16px')
    // Text stays on one line.
    await expect(cellStyle.whiteSpace).toBe('nowrap')

    // Nothing under the last row.
    const lastCell = rows[rows.length - 1]!.querySelector('td') as HTMLElement
    await expect(getComputedStyle(lastCell).borderBottomWidth).toBe('0px')
    // …but there is a rule between rows.
    await expect(getComputedStyle(firstCell).borderBottomWidth).not.toBe('0px')

    // The search box is 288px.
    const search = canvas.getByRole('textbox', { name: /search widgets/i })
    const group = search.closest('[data-slot="input-group"]') ?? search.parentElement!
    await expect(Math.round(group.getBoundingClientRect().width)).toBe(288)

    // Headings are uppercase 11px, and nothing anywhere is bold.
    const headerLabel = header.querySelector('span') as HTMLElement
    const labelStyle = getComputedStyle(headerLabel)
    await expect(labelStyle.textTransform).toBe('uppercase')
    await expect(labelStyle.fontSize).toBe('11px')
    await expect(Number(labelStyle.fontWeight)).toBeLessThanOrEqual(500)
  },
}

/**
 * Columns fill the width; nothing scrolls sideways and nothing is pinned.
 *
 * Pinning that is on whether or not it is needed draws a divider and a shadow
 * around a column that is not going anywhere, so it is derived from the
 * overflow rather than configured.
 */
export const ColumnsFillTheWidth: Story = {
  args: { rowActions: () => [{ label: 'Open', icon: <EyeIcon aria-hidden />, onSelect: fn() }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls 1')

    const table = canvasElement.querySelector('table') as HTMLElement
    const frame = canvasElement.querySelector('[data-slot="entity-list-frame"]') as HTMLElement

    await waitFor(async () => {
      // Within a pixel of the frame: the columns were stretched to fill it.
      await expect(Math.abs(table.getBoundingClientRect().width - frame.clientWidth)).toBeLessThan(
        2,
      )
    })

    // Nothing overflows, so nothing is pinned.
    await expect(canvasElement.querySelectorAll('[data-pinned]').length).toBe(0)

    // The actions column is 40px.
    const headers = [...canvasElement.querySelectorAll('thead th')] as HTMLElement[]
    const actions = headers[headers.length - 1]!
    await expect(Math.round(actions.getBoundingClientRect().width)).toBe(40)
  },
}

/**
 * Too many columns for the width: the table scrolls, and *then* the `⋯`
 * column pins with its divider.
 */
export const PinsOnlyWhenScrolling: Story = {
  args: {
    rowActions: () => [{ label: 'Open', icon: <EyeIcon aria-hidden />, onSelect: fn() }],
    columns: [...COLUMNS, ...COLUMNS.map((c) => ({ ...c, id: `${c.id}2` }))],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    // The columns are doubled to force the overflow, so the name appears twice.
    await within(canvasElement).findAllByText('API calls 1')

    await waitFor(async () => {
      await expect(canvasElement.querySelectorAll('[data-pinned]').length).toBeGreaterThan(0)
    })
    // The divider marks the boundary between pinned and scrolling columns.
    await expect(canvasElement.querySelector('[data-last-col]')).not.toBeNull()
  },
}

/** Sorting: the arrow appears only once a column is sorted. */
export const SortArrowOnlyWhenSorted: Story = {
  args: {
    sort: {
      options: [
        { value: 'name', label: 'Name' },
        { value: 'created', label: 'Created' },
      ],
      field: 'name',
      direction: 'asc',
      onChange: fn(),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls 1')

    // The sorted column shows its arrow…
    const sorted = canvas.getByRole('button', { name: /widget, sorted ascending/i })
    await expect(sorted.querySelector('svg')).not.toBeNull()
    // …and an unsorted-but-sortable one shows none.
    const unsorted = canvas.getByRole('button', { name: /^sort by created$/i })
    await expect(unsorted.querySelector('svg')).toBeNull()

    await userEvent.click(sorted)
    await expect(args.sort!.onChange).toHaveBeenCalledWith('name', 'desc')
  },
}

/** Filter and sort are icon buttons; an active filter badges its count. */
export const FilterBadge: Story = {
  args: {
    filter: {
      fields: [
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'published', label: 'Published' },
            { value: 'archived', label: 'Archived' },
          ],
          operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
          defaultOperator: 'is_any_of',
        },
      ],
      query: createFilterQuery(),
      onQueryChange: fn(),
      activeCount: 2,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const filter = await canvas.findByRole('button', { name: /filter\. 2 active/i })
    await expect(within(filter).getByText('2')).toBeInTheDocument()
  },
}

/** The `⋯` menu hides a column and exports the visible ones. */
export const ColumnsAndExport: Story = {
  args: { exportFileName: 'widgets' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls 1')
    await expect(canvas.getByText('Seats')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /table options/i }))
    const menu = within(await within(document.body).findByRole('menu'))
    await expect(menu.getByRole('menuitem', { name: /export csv/i })).toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitemcheckbox', { name: 'Seats' }))

    await waitFor(async () => {
      await expect(canvas.queryByText('Seats')).not.toBeInTheDocument()
    })
  },
}

/** A filter emptied the list: the toolbar stays, so the filter can be undone. */
export const FilteredEmpty: Story = {
  args: { rows: [], total: 0, isFiltered: true, search: 'zzz', onClearFilters: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/no widgets match these filters/i)).toBeInTheDocument()
    // The search box survives, which is the only way back.
    await expect(canvas.getByRole('textbox', { name: /search widgets/i })).toBeInTheDocument()
  },
}

/** Nothing has been created yet: the illustration, two 32px buttons, and
 *  three guide cards that each end in "Read docs". */
export const FirstRun: Story = {
  args: {
    rows: [],
    total: 0,
    empty: {
      title: 'No widgets yet',
      description: 'A widget is the thing you meter. Create one to start measuring.',
      actions: (
        <>
          <Button>New widget</Button>
          <Button variant="outline">Import</Button>
        </>
      ),
      guides: [
        {
          title: 'What a widget is',
          description: 'The model, in two minutes.',
          href: 'https://example.com/widgets',
          icon: <BookOpenIcon aria-hidden className="size-4" />,
        },
        {
          title: 'Your first widget',
          description: 'A worked example, end to end.',
          href: 'https://example.com/quickstart',
          icon: <RocketIcon aria-hidden className="size-4" />,
        },
        {
          title: 'Wiring it up',
          description: 'Send events and see them land.',
          href: 'https://example.com/events',
          icon: <WrenchIcon aria-hidden className="size-4" />,
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No widgets yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)

    // Two 32px buttons.
    const create = canvas.getByRole('button', { name: 'New widget' })
    await expect(Math.round(create.getBoundingClientRect().height)).toBe(32)
    await expect(
      Math.round(canvas.getByRole('button', { name: 'Import' }).getBoundingClientRect().height),
    ).toBe(32)

    // Nothing to search, filter or sort yet, so no toolbar.
    await expect(canvas.queryByRole('textbox', { name: /search widgets/i })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^(filter|sort by)/i })).toBeNull()
  },
}

export const Loading: Story = { args: { rows: [], total: 0, isLoading: true } }

/** `border`: the same rows inside a rounded outline; the toolbar stays outside it. */
export const Bordered: Story = {
  args: { border: true },
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-slot="entity-list-frame"]')
    await expect(frame).toHaveAttribute('data-border')
  },
}

export const Failed: Story = {
  args: { rows: [], total: 0, error: 'Could not reach Flexprice.', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/**
 * Zero rows on page 3 of a list that has records is "this page is past the end",
 * not "create your first record". The way back is one button.
 */
export const OutOfRange: Story = {
  args: { rows: [], total: 60, page: 3, pageSize: 25, onPaginationChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('This page is out of range')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Go to first page' }))
    await expect(args.onPaginationChange).toHaveBeenCalledWith(1, 25)
  },
}

/** A background refetch: the rows stay on screen and are never swapped for a spinner. */
export const Refreshing: Story = {
  args: { isRefreshing: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('API calls 1')).toBeInTheDocument()
  },
}

/** Paging reports a 1-based page and the size together. */
export const Paginates: Story = {
  args: { rows: widgets(25), total: 120, pageSize: 25 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /next/i }))

    // The grid also fires on settle, so the Next click is not necessarily
    // call[0]. Wait for the call that reported page 2.
    const spy = args.onPaginationChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() => expect(spy.mock.calls.some((call) => call[0] === 2)).toBe(true))
  },
}
