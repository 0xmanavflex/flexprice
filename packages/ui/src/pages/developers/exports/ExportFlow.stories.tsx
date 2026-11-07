import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_EXPORT_RUN_QUERY, type ExportRunQuery, type S3Connection } from '@fp/domain'
import {
  type DataExportTab,
  DataExportDetail,
  ExportRunList,
  ExportsOverview,
  S3ConnectionList,
} from './ExportFlow'
import { CONNECTIONS, EXPORT, RUNS } from './exportStoryFixtures'

const meta = {
  title: 'App/Developers/Exports/Export flow',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The landing page once a bucket is connected: the S3 destination and the list, no explainer. */
export const Overview: Story = {
  render: () => (
    <ExportsOverview s3Connections={2} onOpenS3={fn()}>
      <p className="text-muted-foreground text-sm">Every export, in the grid.</p>
    </ExportsOverview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Automated exports')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Configure Amazon S3' })).toBeVisible()
    await expect(canvas.getByText('Connected')).toBeVisible()
  },
}

/** The first visit, before any bucket: what exports do leads the page. */
export const OverviewFirstRun: Story = {
  render: () => (
    <ExportsOverview s3Connections={0} onOpenS3={fn()}>
      <p className="text-muted-foreground text-sm">No exports yet.</p>
    </ExportsOverview>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Automated exports')).toBeVisible()
  },
}

/** The S3 connections, with export counts; Add connection opens the connect dialog. */
export const S3Connections: Story = {
  render: () => (
    <S3ConnectionList
      connections={CONNECTIONS}
      exportCounts={new Map([['conn_s3_01', 4]])}
      onBack={fn()}
      onOpen={fn()}
      onCreate={fn(async () => undefined)}
      onUpdate={fn(async () => undefined)}
      onDelete={fn(async () => undefined)}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Acme data lake')).toBeVisible()
    await expect(canvas.getByText('4 exports')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add connection' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Connect' }))
    await expect(await dialog.findByText('Name the connection')).toBeVisible()
    await expect(dialog.getByText('Enter the AWS access key ID')).toBeVisible()
    // A managed bucket needs no keys.
    await userEvent.click(dialog.getByRole('switch'))
    await expect(dialog.queryByLabelText(/AWS access key ID/)).toBeNull()
  },
}

const onUpdate = fn(async () => undefined)

/** Edit renames a connection or rotates its keys; a new key needs both halves. */
export const EditS3Connection: Story = {
  render: () => (
    <S3ConnectionList
      connections={CONNECTIONS}
      onBack={fn()}
      onOpen={fn()}
      onCreate={fn(async () => undefined)}
      onUpdate={onUpdate}
      onDelete={fn(async () => undefined)}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Acme data lake' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByDisplayValue('Acme data lake')).toBeVisible()
    await expect(dialog.queryByRole('switch')).toBeNull()
    await userEvent.type(dialog.getByLabelText(/New AWS access key ID/), 'AKIANEW')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await expect(await dialog.findByText('Enter the new AWS secret access key')).toBeVisible()
    await userEvent.type(dialog.getByLabelText(/New AWS secret access key/), 'new-secret')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        CONNECTIONS[0],
        expect.objectContaining({ accessKeyId: 'AKIANEW', secretAccessKey: 'new-secret' }),
      ),
    )
  },
}

export const NoConnections: Story = {
  render: () => (
    <S3ConnectionList
      connections={[]}
      onBack={fn()}
      onOpen={fn()}
      onCreate={fn(async () => undefined)}
      onUpdate={fn(async () => undefined)}
      onDelete={fn(async () => undefined)}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No S3 connections yet')).toBeVisible()
  },
}

const setEnabled = fn(async (_enabled: boolean) => undefined)

function Detail({ connection = CONNECTIONS[0] }: { connection?: S3Connection | undefined }) {
  const [tab, setTab] = useState<DataExportTab>('overview')
  const [query, setQuery] = useState<ExportRunQuery>(DEFAULT_EXPORT_RUN_QUERY)
  return (
    <DataExportDetail
      dataExport={EXPORT}
      connection={connection}
      tab={tab}
      onTabChange={setTab}
      trail={[{ label: 'Exports', onClick: fn() }, { label: 'Credit usage export' }]}
      onSetEnabled={setEnabled}
      onRun={fn(async () => undefined)}
      onDelete={fn(async () => undefined)}
      runs={
        <ExportRunList
          runs={RUNS}
          total={23}
          query={query}
          onQueryChange={setQuery}
          onDownload={fn(async () => 'https://example.com/file.csv')}
        />
      }
    />
  )
}

/** One export: its settings, then its runs; Pause asks first. */
export const ExportDetail: Story = {
  render: () => <Detail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Credit usage export' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata columns' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Export actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pause export' }))
    const confirm = within(await screen.findByRole('dialog'))
    await userEvent.click(confirm.getByRole('button', { name: 'Pause export' }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false))
    await userEvent.click(canvas.getByRole('tab', { name: 'Runs' }))
    await expect(await canvas.findByText('run_001')).toBeVisible()
  },
}

/** A Flexprice-managed connection still names its bucket and region: both are shown. */
export const ManagedBucketDetail: Story = {
  render: () => <Detail connection={CONNECTIONS[1]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('acme-warehouse')).toBeVisible()
    await expect(canvas.getByText('eu-west-1')).toBeVisible()
    await expect(canvas.queryByText('Managed by Flexprice')).not.toBeInTheDocument()
  },
}

/** Run now: a custom window needs both ends, the end after the start. */
export const RunNow: Story = {
  render: () => <Detail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Run now' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('radio', { name: /custom window/i }))
    await userEvent.click(dialog.getByRole('button', { name: 'Run export' }))
    await expect(await dialog.findByText('Choose when the window starts')).toBeVisible()
  },
}
