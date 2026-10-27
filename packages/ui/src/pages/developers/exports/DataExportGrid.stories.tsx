import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_DATA_EXPORT_QUERY, type DataExport } from '@fp/domain'
import { DataExportGrid } from './DataExportGrid'

function fixtures(): DataExport[] {
  return [
    {
      id: 'task_01',
      connectionId: 'conn_01',
      entity: 'invoice',
      entityLabel: 'Invoices',
      interval: 'daily',
      intervalLabel: 'Daily',
      enabled: true,
      bucket: 'acme-billing',
      region: 'us-east-1',
      keyPrefix: 'flexprice/invoices/',
      compression: 'gzip',
      encryption: 'AES256',
      endpointUrl: '',
      metadataFields: [],
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-02T00:00:00Z'),
    },
    {
      id: 'task_02',
      connectionId: 'conn_01',
      entity: 'events',
      entityLabel: 'Events',
      interval: 'hourly',
      intervalLabel: 'Hourly',
      enabled: false,
      bucket: 'acme-usage',
      region: 'eu-west-1',
      keyPrefix: '',
      compression: 'none',
      encryption: 'AES256',
      endpointUrl: '',
      metadataFields: [],
      createdAt: new Date('2026-02-10T00:00:00Z'),
      updatedAt: null,
    },
  ]
}

function manyExports(count: number): DataExport[] {
  const base = fixtures()
  return Array.from({ length: count }, (_, index) => {
    const row = base[index % base.length] as DataExport
    return {
      ...row,
      id: `task_gen_${index}`,
      bucket: `${row.bucket}-${index + 1}`,
      enabled: index % 3 !== 1,
    }
  })
}

const meta = {
  title: 'App/Developers/Exports/Export table',
  component: DataExportGrid,
  parameters: { layout: 'padded' },
  args: {
    exports: fixtures(),
    total: 2,
    query: { ...DEFAULT_DATA_EXPORT_QUERY },
    onQueryChange: fn(),
    onRefresh: fn(),
    locale: 'en-US',
  },
  argTypes: {
    exports: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onRefresh: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof DataExportGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof DataExportGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function DataExportGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...DEFAULT_DATA_EXPORT_QUERY, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <DataExportGrid
      {...args}
      exports={manyExports(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to data exports in this environment.' : null}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging; toggle loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 30, hasError: false, page: 1, pageSize: 10, isLoading: false },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <DataExportGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('acme-billing')).toBeInTheDocument()
    await expect(canvas.getByText('Invoices')).toBeInTheDocument()
    await expect(canvas.getByText('Paused')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { exports: [], total: 0 } }

export const Searching: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search exports'), 'acme')
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining('a') }),
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

/** The Status filter names states as the rows do: Active and Paused, not Enabled and Disabled. */
export const FilteringByStatus: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced filter' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Status' }))
    await userEvent.click(await screen.findByRole('option', { name: 'is' }))
    // The operator list closes as the value list opens; both are labelled Status, so wait for the value list.
    await waitFor(
      async () =>
        expect(
          within(await screen.findByRole('listbox', { name: 'Status' }))
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual(['Active', 'Paused']),
      { timeout: 3000 },
    )
    const values = screen.getByRole('listbox', { name: 'Status' })
    await userEvent.click(within(values).getByRole('option', { name: 'Paused' }))
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'disabled' }),
      ),
    )
  },
}
