import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { DataFreshness, DataRegion, Deferred, PartialDataNotice } from './DataBoundary'
import { ErrorState, type ErrorKind } from './States'
import { RetryAction } from './RetryAction'
import { TableSkeleton } from './Skeletons'

const meta = {
  title: 'Building blocks/Feedback & states/Data boundary',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta

/** Toggle loading: a quick load draws nothing, a longer one draws the skeleton, a slow one says so. */
export const DeferredLoading: StoryObj = {
  render: function Render() {
    const [loading, setLoading] = useState(true)
    return (
      <div className="flex flex-col gap-3">
        <Button size="sm" variant="outline" onClick={() => setLoading((v) => !v)}>
          {loading ? 'Finish loading' : 'Load again'}
        </Button>
        <Deferred
          loading={loading}
          fallback={<TableSkeleton rows={4} />}
          gate={{ delayMs: 0, minMs: 0, slowMs: 1500 }}
        >
          <p className="text-sm">Loaded content.</p>
        </Deferred>
      </div>
    )
  },
}

/** The next page is loading: the rows stay, dimmed, and the bar runs. */
export const RefreshingRegion: StoryObj = {
  render: () => (
    <DataRegion state={{ refreshing: true, provisional: true }}>
      <TableSkeleton rows={3} />
    </DataRegion>
  ),
}

export const Freshness: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <DataFreshness updatedAt={Date.now() - 3 * 60_000} />
      <DataFreshness updatedAt={Date.now() - 12 * 60_000} stale onRefresh={fn()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Updated 3 min ago/)).toBeInTheDocument()
    await expect(canvas.getByRole('status')).toHaveTextContent(/Couldn’t refresh/)
  },
}

export const Partial: StoryObj = {
  render: () => <PartialDataNotice failed={['Revenue', 'Usage']} onRetry={fn()} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Revenue and Usage couldn’t be loaded',
    )
  },
}

const KINDS: ErrorKind[] = ['network', 'timeout', 'server', 'rate-limited', 'denied', 'unavailable']

/** Each failure kind picks its own copy; denied and unavailable never offer a retry. */
export const ErrorKinds: StoryObj = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      {KINDS.map((kind) => (
        <ErrorState
          key={kind}
          kind={kind}
          title={`Failure: ${kind}`}
          onRetry={fn()}
          {...(kind === 'rate-limited' ? { retryAfterMs: 5000 } : {})}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('alert')).toHaveLength(KINDS.length)
    await expect(canvas.getAllByRole('button')).toHaveLength(4)
  },
}

export const ErrorPage: StoryObj = {
  render: () => (
    <ErrorState
      variant="page"
      kind="network"
      title="Can’t load customers"
      onRetry={fn()}
      requestId="req_8f2a"
    />
  ),
}

/** Mashing the button fires once. */
export const Retry: StoryObj = {
  render: () => {
    const onRetry = fn()
    return <RetryAction onRetry={onRetry} />
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Try again' })
    await userEvent.dblClick(button)
    await expect(button).toBeEnabled()
  },
}
