import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClockIcon,
  CirclePauseIcon,
  DatabaseIcon,
  DownloadIcon,
  EyeIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UploadIcon,
} from '@ui/icons'
import {
  type CreateDataExport,
  type CreateS3Connection,
  type DataExport,
  EXPORT_METADATA_ENTITY_LABEL,
  EXPORT_RUN_STATUS,
  EXPORT_RUN_STATUS_LABEL,
  type ExportRun,
  type ExportRunQuery,
  type ExportRunRequest,
  type ExportRunStatus,
  type S3Connection,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@ui/components/primitives/item'
import { DetailMoreMenu, DetailTabs, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { DetailShell, type DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { PageBody } from '@ui/compositions/layout/Page'
import { EntityHeader } from '../../shared/EntityHeader'
import { Section } from '@ui/compositions/layout/Section'
import { usePublishDetailTrail } from '@ui/compositions/shell/ShellDetailTrail'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { provenance } from '@ui/provenance'
import { ConnectorCard } from '@ui/compositions/layout/ConnectorCard'
import { INTEGRATION_LOGOS, INTEGRATION_LOGOS_DARK } from '@ui/assets/integrations'
import { EntityList, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, Pill, idColumn, pillColumn, textColumn } from '../../shared/cells'
import { DataExportDialog, RunExportDialog, S3ConnectionDialog } from './ExportForms'
import { statusTone } from '../../shared/statusTones'

/**
 * The Exports flow, as V1 has it, on the console's kit:
 *
 * 1. **Exports**: what exports do, the destinations (Amazon S3), and every
 *    export below.
 * 2. **Amazon S3**: the S3 connections, each with its export count; connect
 *    one, open one, or delete one.
 * 3. **A connection**: its exports; create one, open one, or delete one.
 * 4. **An export**: pause or resume it, run it now, delete it; Overview and
 *    Runs tabs, the runs with their status, window and file.
 *
 * Every write is a promise from the page: success is a toast, a failure stays
 * in the dialog that made it.
 */
export const ExportFlowProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/detail-shell',
    'compositions/detail-kit',
    'compositions/section',
    'compositions/section-empty',
    'compositions/confirm-dialog',
    'compositions/detail-list',
    'compositions/page',
    'ui/item',
    'reui/badge',
    'pages/shared/EntityList',
    'pages/shared/cells',
    'pages/developers/exports/export-forms',
  ],
  note: 'V1 exports flow: overview with destinations, S3 connections, a connection’s exports, and an export’s detail with runs.',
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** A confirm that runs a promise, keeping its pending flag and failure. */
function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = (next: T) => {
    setError(null)
    setTarget(next)
  }
  const close = () => {
    if (pending) return
    setTarget(null)
    setError(null)
  }
  const confirm = async (
    action: (target: T) => Promise<unknown>,
    done: string,
    fallback: string,
  ) => {
    if (target === null) return
    setPending(true)
    setError(null)
    try {
      await action(target)
      toast.success(done)
      setTarget(null)
    } catch (caught) {
      setError(messageOf(caught, fallback))
    } finally {
      setPending(false)
    }
  }
  return { target, pending, error, open, close, confirm }
}

/** A write that toasts on success and keeps its failure for the dialog. */
function useWrite() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, done: string, fallback: string) => {
    setPending(true)
    setError(null)
    try {
      await action()
      toast.success(done)
      return true
    } catch (caught) {
      setError(messageOf(caught, fallback))
      return false
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run, reset: () => setError(null) }
}

function formatDateTime(value: Date | null, locale?: string): string {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
    : '—'
}

/* ---- 1. Exports ------------------------------------------------------------ */

const HIGHLIGHTS = [
  {
    icon: <CalendarClockIcon aria-hidden className="size-5" />,
    title: 'Automated exports',
    body: 'Billing data is written on a schedule, hourly or daily, with no code to run.',
  },
  {
    icon: <DatabaseIcon aria-hidden className="size-5" />,
    title: 'Ready to query',
    body: 'Events, invoices, credits and usage land as files your warehouse can load.',
  },
  {
    icon: <ShieldCheckIcon aria-hidden className="size-5" />,
    title: 'Secure storage',
    body: 'Files are encrypted and written to a bucket you own, or one Flexprice manages.',
  },
]

/** The Amazon S3 mark, colour in light mode and white in dark, as the integration tiles draw theirs. */
function S3Logo() {
  return (
    <>
      <img
        src={INTEGRATION_LOGOS['s3']}
        alt=""
        className="max-h-full max-w-full object-contain dark:hidden"
      />
      <img
        src={INTEGRATION_LOGOS_DARK['s3']}
        alt=""
        className="hidden max-h-full max-w-full object-contain dark:block"
      />
    </>
  )
}

export interface ExportsOverviewProps {
  /** How many S3 connections there are; null while loading. */
  s3Connections: number | null
  onOpenS3: () => void
  /** Every export, in the grid. */
  children: ReactNode
}

/** The Exports landing page: what exports do, where they go, and every export. */
export function ExportsOverview({ s3Connections, onOpenS3, children }: ExportsOverviewProps) {
  return (
    <PageBody>
      <div className="flex flex-col gap-6">
        {/* What exports do, for the first visit only: once a bucket is connected it is noise. */}
        {s3Connections === 0 ? (
          <Section
            title="Overview"
            description="Send billing data to your own storage on a schedule."
          >
            <ItemGroup className="grid gap-3 md:grid-cols-3">
              {HIGHLIGHTS.map((item) => (
                <Item key={item.title} role="listitem" variant="outline" className="items-start">
                  <ItemMedia variant="icon">{item.icon}</ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.body}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </Section>
        ) : null}
        <Section title="Destinations">
          {/* The integrations gallery's card, so S3 reads as the connector it is. */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ConnectorCard
              testId="export-destination-s3"
              name="Amazon S3"
              description="Export to an S3 bucket, or any S3-compatible storage, for your data warehouse and analytics."
              logo={<S3Logo />}
              connected={(s3Connections ?? 0) > 0}
              onConnect={onOpenS3}
              onConfigure={onOpenS3}
            />
          </div>
        </Section>
        {children}
      </div>
    </PageBody>
  )
}

/* ---- 2. Amazon S3 ------------------------------------------------------------ */

export interface S3ConnectionListProps {
  connections: S3Connection[]
  /** Exports per connection id; absent while loading. */
  exportCounts?: ReadonlyMap<string, number> | undefined
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onBack: () => void
  onOpen: (connection: S3Connection) => void
  onCreate: (draft: CreateS3Connection) => Promise<unknown>
  onDelete: (connection: S3Connection) => Promise<unknown>
}

const S3_FEATURES = [
  ['Every data set', 'Events, invoices, credit top-ups, credit usage and usage analytics.'],
  ['On a schedule', 'Hourly or daily, and on demand for any past window.'],
  ['Secure by default', 'Server-side AES-256 encryption; keys are stored encrypted.'],
  ['Compressed or not', 'Plain files, or gzip to save space and transfer.'],
] as const

/** The S3 connections, each with its exports. */
export function S3ConnectionList({
  connections,
  exportCounts,
  isLoading = false,
  error = null,
  onRetry,
  onBack,
  onOpen,
  onCreate,
  onDelete,
}: S3ConnectionListProps) {
  usePublishDetailTrail([{ label: 'Exports', onClick: onBack }, { label: 'Amazon S3' }])
  const [adding, setAdding] = useState(false)
  const remove = useConfirm<S3Connection>()

  // A section's action is outline (design rules §2); the page's one filled
  // button is a list's primary create, and this is a section.
  const addButton = (
    <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => setAdding(true)}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      Add connection
    </Button>
  )

  return (
    <PageBody>
      <div className="flex flex-col gap-6">
        <Section title="S3 connections" actions={addButton} flush>
          {isLoading ? (
            <p className="text-muted-foreground p-6 text-sm">Loading connections…</p>
          ) : error ? (
            <SectionEmpty
              title="Connections could not be loaded"
              description={error}
              {...(onRetry
                ? {
                    action: (
                      <Button variant="outline" onClick={onRetry}>
                        Try again
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : connections.length === 0 ? (
            <SectionEmpty
              scene="developers"
              title="No S3 connections yet"
              description="Connect a bucket to start exporting billing data to it."
            />
          ) : (
            <ItemGroup className="divide-y">
              {connections.map((connection) => {
                const count = exportCounts?.get(connection.id)
                return (
                  <Item key={connection.id} role="listitem" className="rounded-none px-6 py-4">
                    <ItemMedia className="bg-background size-9 rounded-md border p-1.5 shadow-xs">
                      <S3Logo />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{connection.name}</ItemTitle>
                      <ItemDescription>
                        {connection.flexpriceManaged ? 'Flexprice-managed' : 'Your bucket'}
                        {connection.status ? ` · ${connection.status}` : ''}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-4">
                      {count === undefined ? null : (
                        <Badge variant="outline">
                          {count} {count === 1 ? 'export' : 'exports'}
                        </Badge>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onOpen(connection)}>
                        <EyeIcon data-icon="inline-start" aria-hidden />
                        View exports
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${connection.name}`}
                        onClick={() => remove.open(connection)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </Section>
        <Section title="What S3 exports do">
          <DetailList items={S3_FEATURES.map(([label, value]) => ({ label, value }))} />
        </Section>
      </div>
      <S3ConnectionDialog
        open={adding}
        onOpenChange={setAdding}
        onSubmit={async (draft) => {
          await onCreate(draft)
          toast.success('S3 connection added')
        }}
      />
      <ConfirmDialog
        open={remove.target !== null}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this connection?"
        description={`Exports stop writing to ${remove.target?.name ?? 'this bucket'}. Files already written stay in the bucket.`}
        confirmLabel="Delete connection"
        destructive
        isPending={remove.pending}
        error={remove.error}
        onConfirm={() =>
          void remove.confirm(
            onDelete,
            'Connection deleted',
            'The connection could not be deleted.',
          )
        }
      />
    </PageBody>
  )
}

/* ---- 3. A connection's exports --------------------------------------------- */

export interface ConnectionExportsProps {
  connection: S3Connection
  /** The exports grid (`DataExportGrid`), given the Add task action. */
  renderGrid: (actions: { newExport: ReactNode; onDelete: (row: DataExport) => void }) => ReactNode
  onBack: () => void
  onBackToExports: () => void
  onCreate: (draft: CreateDataExport) => Promise<unknown>
  onDelete: (row: DataExport) => Promise<unknown>
}

/**
 * One connection's exports (its tasks): a header naming the connection, then
 * the grid, whose create action reads "Add task".
 */
export function ConnectionExports({
  connection,
  renderGrid,
  onBack,
  onBackToExports,
  onCreate,
  onDelete,
}: ConnectionExportsProps) {
  const [adding, setAdding] = useState(false)
  const remove = useConfirm<DataExport>()

  return (
    <>
      <EntityHeader
        trail={[
          { label: 'Exports', onClick: onBackToExports },
          { label: 'Amazon S3', onClick: onBack },
          { label: connection.name || 'Connection' },
        ]}
        icon={<UploadIcon aria-hidden />}
        title={connection.name || 'Amazon S3 connection'}
        badges={
          <Badge variant="secondary">
            {connection.flexpriceManaged ? 'Flexprice-managed' : 'Your bucket'}
          </Badge>
        }
        id={connection.id}
      />
      <PageBody>
        {renderGrid({
          newExport: (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Add task
            </Button>
          ),
          onDelete: remove.open,
        })}
        <DataExportDialog
          open={adding}
          onOpenChange={setAdding}
          connectionId={connection.id}
          flexpriceManaged={connection.flexpriceManaged}
          onSubmit={async (draft) => {
            await onCreate(draft)
            toast.success('Export created')
          }}
        />
        <ConfirmDialog
          open={remove.target !== null}
          onOpenChange={(open) => !open && remove.close()}
          title="Delete this export?"
          description={`${remove.target?.entityLabel ?? 'This'} export stops running. Files already written stay in the bucket.`}
          confirmLabel="Delete export"
          destructive
          isPending={remove.pending}
          error={remove.error}
          onConfirm={() =>
            void remove.confirm(onDelete, 'Export deleted', 'The export could not be deleted.')
          }
        />
      </PageBody>
    </>
  )
}

/* ---- 4. An export --------------------------------------------------------- */

export type DataExportTab = 'overview' | 'runs'

export interface DataExportDetailProps {
  dataExport: DataExport
  connection: S3Connection | undefined
  tab: DataExportTab
  onTabChange: (tab: DataExportTab) => void
  trail: DetailCrumb[]
  onSetEnabled: (enabled: boolean) => Promise<unknown>
  onRun: (window: ExportRunRequest) => Promise<unknown>
  onDelete: () => Promise<unknown>
  /** The runs table (`ExportRunList`), on the Runs tab. */
  runs: ReactNode
  locale?: string
}

/** One export: pause or resume, run now, delete; its settings and its runs. */
export function DataExportDetail({
  dataExport,
  connection,
  tab,
  onTabChange,
  trail,
  onSetEnabled,
  onRun,
  onDelete,
  runs,
  locale,
}: DataExportDetailProps) {
  const [dialog, setDialog] = useState<'toggle' | 'delete' | 'run' | null>(null)
  const write = useWrite()
  const closeDialog = () => {
    if (write.pending) return
    write.reset()
    setDialog(null)
  }
  const managed = connection?.flexpriceManaged ?? false
  const enabled = dataExport.enabled

  const overview = (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Section title="Basic information">
        <DetailList
          columns={1}
          items={[
            // The status is the header's badge; it is not repeated here.
            { label: 'Data', value: dataExport.entityLabel },
            { label: 'Runs', value: dataExport.intervalLabel },
            { label: 'Connection', value: connection?.name || '—' },
          ]}
        />
      </Section>
      <Section title="S3 configuration">
        <DetailList
          columns={1}
          items={[
            { label: 'Bucket', value: managed ? 'Managed by Flexprice' : dataExport.bucket || '—' },
            { label: 'Region', value: managed ? 'Managed by Flexprice' : dataExport.region || '—' },
            {
              label: 'Key prefix',
              value: <span className="break-all">{dataExport.keyPrefix || '—'}</span>,
            },
            { label: 'Compression', value: dataExport.compression === 'gzip' ? 'Gzip' : 'None' },
            {
              label: 'Encryption',
              value:
                dataExport.encryption === 'AES256' ? 'AES-256' : dataExport.encryption || 'AES-256',
            },
            ...(dataExport.endpointUrl
              ? [
                  {
                    label: 'Custom endpoint',
                    value: <span className="break-all">{dataExport.endpointUrl}</span>,
                  },
                ]
              : []),
          ]}
        />
      </Section>
      {dataExport.metadataFields.length > 0 ? (
        <Section title="Metadata columns" flush>
          <SimpleTable
            columns={[
              {
                key: 'source',
                header: 'Source',
                cell: (row) => EXPORT_METADATA_ENTITY_LABEL[row.entity],
              },
              { key: 'key', header: 'Key', cell: (row) => row.fieldKey },
              { key: 'column', header: 'Column', cell: (row) => row.columnName || row.fieldKey },
            ]}
            rows={dataExport.metadataFields}
            getRowId={(row) => `${row.entity}-${row.fieldKey}`}
          />
        </Section>
      ) : null}
      <Section title="Timestamps">
        <DetailList
          columns={1}
          items={[
            { label: 'Created', value: formatDateTime(dataExport.createdAt, locale) },
            { label: 'Last updated', value: formatDateTime(dataExport.updatedAt, locale) },
          ]}
        />
      </Section>
    </div>
  )

  return (
    <DetailShell
      trail={trail}
      icon={<UploadIcon />}
      title={`${dataExport.entityLabel} export`}
      badges={<Pill tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Active' : 'Paused'}</Pill>}
      id={dataExport.id}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDialog('run')}>
            Run now
          </Button>
          <DetailMoreMenu
            label="Export actions"
            items={[
              {
                id: 'toggle',
                label: enabled ? 'Pause export' : 'Resume export',
                icon: enabled ? (
                  <CirclePauseIcon className="text-muted-foreground" aria-hidden />
                ) : (
                  <PlayIcon className="text-muted-foreground" aria-hidden />
                ),
                onSelect: () => setDialog('toggle'),
              },
              {
                id: 'delete',
                label: 'Delete export',
                icon: <Trash2Icon aria-hidden />,
                destructive: true,
                onSelect: () => setDialog('delete'),
              },
            ]}
          />
        </div>
      }
    >
      <DetailTabs
        value={tab}
        onValueChange={(next) => onTabChange(next as DataExportTab)}
        tabs={[
          { value: 'overview', label: 'Overview', content: overview },
          { value: 'runs', label: 'Runs', content: runs },
        ]}
      />
      <ConfirmDialog
        open={dialog === 'toggle'}
        onOpenChange={(open) => !open && closeDialog()}
        title={enabled ? 'Pause this export?' : 'Resume this export?'}
        description={
          enabled
            ? 'No files are written while it is paused. You can still run it by hand, or resume it later.'
            : 'Scheduled runs start again from the next interval.'
        }
        confirmLabel={enabled ? 'Pause export' : 'Resume export'}
        isPending={write.pending}
        error={write.error}
        onConfirm={() =>
          void write
            .run(
              () => onSetEnabled(!enabled),
              enabled ? 'Export paused' : 'Export resumed',
              'The export could not be updated.',
            )
            .then((ok) => ok && setDialog(null))
        }
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete this export?"
        description="It stops running. Files already written stay in the bucket."
        confirmLabel="Delete export"
        destructive
        isPending={write.pending}
        error={write.error}
        onConfirm={() =>
          void write
            .run(onDelete, 'Export deleted', 'The export could not be deleted.')
            .then((ok) => ok && setDialog(null))
        }
      />
      <RunExportDialog
        open={dialog === 'run'}
        onOpenChange={(open) => setDialog(open ? 'run' : null)}
        onSubmit={async (window) => {
          await onRun(window)
          toast.success('Export started')
        }}
      />
    </DetailShell>
  )
}

/* ---- Runs ---------------------------------------------------------------- */

export interface ExportRunListProps {
  runs: ExportRun[]
  total: number
  query: ExportRunQuery
  onQueryChange: (query: ExportRunQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Resolves to a short-lived link to the run's file. */
  onDownload: (run: ExportRun) => Promise<string>
  locale?: string
}

/** An export's runs on the shared list (ReUI data grid): status, data window, when, and its file. */
export function ExportRunList({
  runs,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onDownload,
  locale,
}: ExportRunListProps) {
  const download = async (run: ExportRun) => {
    try {
      const url = await onDownload(run)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast.error(messageOf(caught, 'The file could not be downloaded.'))
    }
  }
  const columns: EntityColumn<ExportRun>[] = [
    pillColumn<ExportRun>('status', 'Status', (run) => ({
      label: EXPORT_RUN_STATUS_LABEL[run.status as ExportRunStatus] ?? (run.status || 'Unknown'),
      tone: statusTone(run.status),
    })),
    textColumn<ExportRun>('from', 'Data from', (run) => formatDateTime(run.intervalStart, locale), {
      width: 180,
    }),
    textColumn<ExportRun>('to', 'Data to', (run) => formatDateTime(run.intervalEnd, locale), {
      width: 180,
    }),
    textColumn<ExportRun>('started', 'Started', (run) => formatDateTime(run.startedAt, locale), {
      width: 180,
      muted: true,
    }),
    textColumn<ExportRun>(
      'records',
      'Records',
      (run) => (run.records === null ? null : run.records.toLocaleString(locale)),
      { width: 110 },
    ),
    idColumn<ExportRun>('id', 'Run ID', (run) => run.id, { width: 200 }),
  ]
  const rowActions = (run: ExportRun): EntityRowAction[] => [
    {
      label: 'Download file',
      readOnly: true,
      icon: <DownloadIcon aria-hidden className="size-4" />,
      disabled: !run.hasFile,
      onSelect: () => void download(run),
    },
  ]
  // Narrows the page on screen by run ID; the status filter is the server's.
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const shown = term ? runs.filter((run) => run.id.toLowerCase().includes(term)) : runs
  const isFiltered = query.status !== EXPORT_RUN_STATUS.All || term.length > 0

  return (
    <EntityList<ExportRun>
      label="Runs"
      noun="runs"
      rows={shown}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by run ID…"
      total={total}
      columns={columns}
      getRowId={(run) => run.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      filter={singleChoiceFilter({
        id: 'status',
        label: 'Status',
        value: query.status,
        empty: EXPORT_RUN_STATUS.All,
        choices: Object.values(EXPORT_RUN_STATUS).map((value) => ({
          value,
          label: EXPORT_RUN_STATUS_LABEL[value],
        })),
        onChange: (status) => onQueryChange({ ...query, status, page: 1 }),
      })}
      rowActions={rowActions}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={isFiltered}
      onClearFilters={() => {
        setSearch('')
        onQueryChange({ ...query, status: EXPORT_RUN_STATUS.All, page: 1 })
      }}
      filteredEmptyTitle="No runs with this status"
      empty={{
        scene: 'developers',
        title: 'No runs yet',
        description:
          'Each scheduled or manual run is listed here with the window of data it wrote. Use Run now to start one.',
      }}
    />
  )
}
