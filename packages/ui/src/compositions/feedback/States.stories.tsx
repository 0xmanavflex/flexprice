import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { EmptyState } from './EmptyState'
import { GridToolbar } from '../tables/GridToolbar'
import { ListState, type ListStateProps } from './States'

/**
 * Every state a list can be in, as stories — which is the point of designing
 * them once. A screen that uses `ListState` inherits all of them, tested.
 *
 * The children here are a stand-in for a real grid, because the empty states
 * are only correct *in place*: a list with nothing in it keeps its search, its
 * filters and its footer, and says so in the table body. Passing a bare `div`
 * would test a contract no screen has.
 */
function FakeGrid({ rows, onClearFilters }: { rows: number; onClearFilters?: () => void }) {
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <GridToolbar
        heading="Features"
        search={search}
        onSearchChange={setSearch}
        label="Search features"
        placeholder="Search features…"
      >
        <Button size="sm" variant="outline">
          Filter
        </Button>
      </GridToolbar>

      <table className="w-full border-t">
        <tbody>
          {rows === 0 ? (
            <tr>
              <td className="py-6 text-center">
                {/*
                  What every `*Grid` renders in its empty body: copy for a
                  filtered miss, which `ListState` swaps for the first-run
                  offer when it is the page, and not the filter, that is empty.
                */}
                <EmptyState
                  size="inline"
                  isFiltered
                  title="No features match these filters"
                  description="Try a different search, or clear what is narrowing the list."
                  onClearFilters={
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </td>
            </tr>
          ) : (
            Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                <td className="py-2 text-sm">Feature {row + 1}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="text-muted-foreground text-xs">
        1–{rows} of {rows}
      </p>
    </div>
  )
}

const meta = {
  title: 'Building blocks/Feedback & states/States',
  component: ListState,
  parameters: { layout: 'padded' },
  args: {
    isLoading: false,
    error: null,
    isEmpty: false,
    isFiltered: false,
    emptyTitle: 'No features yet',
    emptyDescription: 'Features describe what you meter and what customers are entitled to.',
    createAction: <Button size="sm">New feature</Button>,
    onRetry: fn(),
    onClearFilters: fn(),
    children: <FakeGrid rows={3} />,
  },
} satisfies Meta<typeof ListState>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Omit<ListStateProps, 'error' | 'children' | 'createAction'> & {
  errorKind: 'none' | 'retryable' | 'denied'
  rows: number
  showCreateAction: boolean
}

/** Flip loading, empty, filtered and error, or drag `rows` to see the list fill; error beats loading. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    isLoading: false,
    isEmpty: false,
    isFiltered: false,
    errorKind: 'none',
    rows: 5,
    showCreateAction: true,
    emptyTitle: 'No features yet',
    emptyDescription: 'Features describe what you meter and what customers are entitled to.',
    onRetry: fn(),
    onClearFilters: fn(),
  },
  argTypes: {
    isLoading: { control: 'boolean' },
    isEmpty: { control: 'boolean', description: 'The query succeeded and returned nothing.' },
    isFiltered: {
      control: 'boolean',
      description: 'With `isEmpty`: a filter caused it, so offer to clear.',
    },
    errorKind: { control: 'inline-radio', options: ['none', 'retryable', 'denied'] },
    rows: {
      control: { type: 'range', min: 0, max: 30, step: 1 },
      description: 'Rows in the stand-in grid.',
    },
    showCreateAction: { control: 'boolean' },
    emptyTitle: { control: 'text' },
    emptyDescription: { control: 'text' },
    onRetry: { control: false },
    onClearFilters: { control: false },
  },
  render: ({ errorKind, rows, showCreateAction, isEmpty, ...args }) => (
    <ListState
      {...args}
      isEmpty={isEmpty}
      error={
        errorKind === 'none'
          ? null
          : errorKind === 'retryable'
            ? { message: 'Could not reach Flexprice.', canRetry: true }
            : { message: 'You do not have access to features here.', canRetry: false }
      }
      {...(showCreateAction ? { createAction: <Button size="sm">New feature</Button> } : {})}
    >
      <FakeGrid rows={isEmpty ? 0 : rows} />
    </ListState>
  ),
}

export const Content: Story = {}

/** A skeleton shaped like the result, not a page spinner. */
export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading')).toBeInTheDocument()
  },
}

/**
 * Nothing created yet — and the list is still a list.
 *
 * This is the regression the arrangement exists to prevent: the empty state
 * used to be returned *instead of* the grid, so the search box, the filters,
 * the footer and the create button all went with it, and the invitation to
 * create the first record was the only thing left that could not be acted on.
 */
export const EmptyNoData: Story = {
  args: { isEmpty: true, children: <FakeGrid rows={0} /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No features yet')).toBeInTheDocument()
    await expect(canvas.queryByText(/match these filters/)).not.toBeInTheDocument()

    // The toolbar survived the emptiness.
    await expect(canvas.getByRole('textbox', { name: 'Search features' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Filter' })).toBeVisible()

    // Offered once, pinned in the toolbar where it stays once rows exist; the
    // empty state says what is missing and does not repeat the button.
    const create = canvas.getAllByRole('button', { name: 'New feature' })
    await expect(create).toHaveLength(1)
    await expect(create[0]).toBeVisible()
  },
}

/**
 * A filter matched nothing — a different situation with a different offer.
 *
 * Showing "create your first feature" to someone who just typed a search is
 * the confusion this separation prevents. The toolbar stays for the more
 * pressing reason that the search which caused this is in it.
 */
export const EmptyFiltered: Story = {
  args: {
    isEmpty: true,
    isFiltered: true,
    children: <FakeGrid rows={0} onClearFilters={fn()} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No features match these filters')).toBeInTheDocument()
    await expect(canvas.queryByText('No features yet')).not.toBeInTheDocument()

    await expect(canvas.getByRole('textbox', { name: 'Search features' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible()
  },
}

export const ErrorRetryable: Story = {
  args: { error: { message: 'Could not reach Flexprice.', canRetry: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/**
 * Permission denied offers no retry.
 *
 * "Try again" on a permission error is worse than nothing — it invites someone
 * to keep pressing a button that will always fail.
 */
export const ErrorDenied: Story = {
  args: { error: { message: 'You do not have access to features here.', canRetry: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await expect(canvas.getByText(/ask an administrator/i)).toBeInTheDocument()
  },
}

/** A failed refetch must not hide behind a skeleton. */
export const ErrorWinsOverLoading: Story = {
  args: { isLoading: true, error: { message: 'Something broke.', canRetry: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await expect(canvas.queryByText('Loading')).not.toBeInTheDocument()
  },
}
