import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  type WorkflowRun,
  type WorkflowRunDetail,
  WorkflowActivityStatus,
  WorkflowStatus,
} from '@fp/domain'
import { WorkflowRunSheet } from './WorkflowRunSheet'

const succeededRun: WorkflowRun = {
  id: 'run_01',
  workflowId: 'price-sync-01',
  name: 'Price sync',
  status: WorkflowStatus.Completed,
  startTime: new Date('2026-03-01T10:00:00Z'),
  closeTime: new Date('2026-03-01T10:00:12Z'),
  durationMs: 12500,
}

const succeeded: WorkflowRunDetail = {
  ...succeededRun,
  type: 'PriceSyncV2Workflow',
  taskQueue: 'billing',
  failureMessage: null,
  activities: [
    {
      id: '5',
      name: 'SyncPlanPricesActivity',
      status: WorkflowActivityStatus.Completed,
      attempts: 1,
      startTime: new Date('2026-03-01T10:00:00Z'),
      closeTime: new Date('2026-03-01T10:00:12Z'),
      durationMs: 12000,
      failureMessage: null,
      failureTime: null,
    },
  ],
}

const failedRun: WorkflowRun = {
  id: 'run_02',
  workflowId: 'recalculate-invoice-inv_01',
  name: 'Recalculate invoice',
  status: WorkflowStatus.Failed,
  startTime: new Date('2026-03-02T10:00:00Z'),
  closeTime: new Date('2026-03-02T10:00:43Z'),
  durationMs: 43294,
}

const failed: WorkflowRunDetail = {
  ...failedRun,
  type: 'RecalculateInvoiceWorkflow',
  taskQueue: 'billing',
  failureMessage: 'recalculation produced no invoice',
  activities: [
    {
      id: '5',
      name: 'LoadInvoiceActivity',
      status: WorkflowActivityStatus.Completed,
      attempts: 1,
      startTime: new Date('2026-03-02T10:00:00Z'),
      closeTime: new Date('2026-03-02T10:00:01Z'),
      durationMs: 400,
      failureMessage: null,
      failureTime: null,
    },
    {
      id: '11',
      name: 'RecalculateInvoiceActivity',
      status: WorkflowActivityStatus.Failed,
      attempts: 3,
      startTime: new Date('2026-03-02T10:00:30Z'),
      closeTime: new Date('2026-03-02T10:00:43Z'),
      durationMs: 13000,
      failureMessage: 'recalculation produced no invoice',
      failureTime: new Date('2026-03-02T10:00:43Z'),
    },
  ],
}

const meta = {
  title: 'App/Developers/Workflows/Workflow run sheet',
  component: WorkflowRunSheet,
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn(), locale: 'en-US', run: succeededRun, detail: succeeded },
} satisfies Meta<typeof WorkflowRunSheet>

export default meta
type Story = StoryObj<typeof meta>

/** A run that finished: its one activity completed first time, and there is no failure. */
export const Succeeded: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('SyncPlanPricesActivity')).toBeInTheDocument()
    await expect(screen.queryByText('Failure')).not.toBeInTheDocument()
    await expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
  },
}

/** A failed run: the failing activity was tried three times, and its message is the run's reason. */
export const FailedWithRetries: Story = {
  args: { run: failedRun, detail: failed },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('RecalculateInvoiceActivity')).toBeInTheDocument()
    await expect(screen.getByRole('alert')).toHaveTextContent('recalculation produced no invoice')
    await expect(screen.getAllByText('recalculation produced no invoice')).toHaveLength(2)
    await expect(screen.getByText('3')).toBeInTheDocument()
  },
}

/** The row's summary shows at once; the activities load behind it. */
export const Loading: Story = {
  args: { run: failedRun, detail: null, isLoading: true },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Recalculate invoice')).toBeInTheDocument()
    await expect(screen.getByLabelText('Loading activities')).toBeInTheDocument()
  },
}

/** The detail could not be read: the error, and a way to try again. */
export const LoadFailed: Story = {
  args: {
    run: failedRun,
    detail: null,
    error: 'Something went wrong loading this workflow run.',
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  },
}
