import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_WORKFLOW_QUERY, type WorkflowRun, WorkflowStatus } from '@fp/domain'
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
