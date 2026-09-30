import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
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
      createdAt: new Date('2026-02-01T00:00:00Z'),
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
      createdAt: new Date('2026-02-10T00:00:00Z'),
    },
  ]
}

const meta = {
  title: 'Surfaces/DataExportGrid',
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
} satisfies Meta<typeof DataExportGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('acme-billing')).toBeInTheDocument()
    await expect(canvas.getByText('Invoices')).toBeInTheDocument()
    await expect(canvas.getByText('Disabled')).toBeInTheDocument()
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
