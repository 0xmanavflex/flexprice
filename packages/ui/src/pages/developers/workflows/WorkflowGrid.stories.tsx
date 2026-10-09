import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_WORKFLOW_QUERY,
  type WorkflowQuery,
  type WorkflowRun,
  WorkflowStatus,
} from '@fp/domain'
import { WorkflowGrid, formatDuration } from './WorkflowGrid'

function fixtures(): WorkflowRun[] {
  return [
    {
      id: 'run_01',
      workflowId: 'price-sync-01',
      name: 'Price sync',
      status: WorkflowStatus.Completed,
      startTime: new Date('2026-03-01T10:00:00Z'),
      closeTime: new Date('2026-03-01T10:00:12Z'),
      durationMs: 12500,
    },
    {
      id: 'run_02',
      workflowId: 'export-02',
      name: 'Data export',
      status: WorkflowStatus.Failed,
      startTime: new Date('2026-03-02T10:00:00Z'),
      closeTime: new Date('2026-03-02T10:03:00Z'),
      durationMs: 180000,
    },
    {
      id: 'run_03',
      workflowId: 'billing-03',
      name: 'Process subscription billing',
      status: WorkflowStatus.Running,
      startTime: new Date('2026-03-03T10:00:00Z'),
      closeTime: null,
      durationMs: null,
    },
  ]
}

/** A deterministic page-worth of runs: the fixtures, cycled with unique ids. */
function manyRuns(count: number): WorkflowRun[] {
  const base = fixtures()
  return Array.from({ length: count }, (_, index) => {
    const item = base[index % base.length] as WorkflowRun
    return { ...item, id: `run_page_${index}`, workflowId: `${item.workflowId}-${index}` }
  })
}

const meta = {
  title: 'Surfaces/WorkflowGrid',
  component: WorkflowGrid,
  parameters: { layout: 'padded' },
  args: {
    runs: fixtures(),
    total: 3,
    query: { ...DEFAULT_WORKFLOW_QUERY },
    onQueryChange: fn(),
    onRefresh: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof WorkflowGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Price sync')).toBeInTheDocument()
    await expect(canvas.getByText('12.5 s')).toBeInTheDocument()
    await expect(canvas.getByText('3 min')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { runs: [], total: 0 } }

export const Searching: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search workflows'), 'exp')
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining('e') }),
      ),
    )
  },
}

export const Refreshing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Refresh' }))
    await expect(args.onRefresh).toHaveBeenCalled()
  },
}

export const DurationUnits: Story = {
  render: () => <p>{[850, 12500, 180000, 5400000].map(formatDuration).join(' · ')}</p>,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('850 ms · 12.5 s · 3 min · 1.5 hr'),
    ).toBeInTheDocument()
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof WorkflowGrid>,
  'runs' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | WorkflowStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function WorkflowGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<WorkflowQuery>({ ...DEFAULT_WORKFLOW_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyRuns(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <WorkflowGrid
      locale="en-US"
      {...rest}
      runs={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to workflows in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(runs|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onRefresh: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(WorkflowStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <WorkflowGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}
