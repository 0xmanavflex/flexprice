import {
  WORKFLOW_ACTIVITY_STATUS_LABEL,
  WORKFLOW_STATUS_LABEL,
  type WorkflowActivity,
  type WorkflowRun,
  type WorkflowRunDetail,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { SimpleTable, type SimpleColumn } from '@ui/compositions/detail/DetailKit'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EmDash, Pill } from '../../shared/cells'
import { WORKFLOW_STATUS_TONE, statusTone } from '../../shared/statusTones'
import { formatDateTime, formatDuration } from './WorkflowGrid'

/**
 * One workflow run, opened from the Workflows list: the answer to "why did
 * this fail?".
 *
 * The run's summary (status, type, ids, when and how long), the failure in the
 * words of the activity that raised it, then every activity it executed with
 * its status, how many times it was tried and its last failure. A sheet over
 * the list, like the other developer detail sheets, so the list stays behind it.
 */
export const WorkflowRunSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'compositions/detail/DetailKit'],
  note: 'Read-only workflow run detail: summary, run failure, activities with attempts and errors.',
})

export interface WorkflowRunSheetProps {
  /** The row that was opened; `null` closes the sheet. Its summary shows while the detail loads. */
  run: WorkflowRun | null
  /** The full run, once read. */
  detail: WorkflowRunDetail | null
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  /** A retry after a failed read is in flight: the sheet shows loading and Try again waits. */
  retrying?: boolean
  onClose: () => void
  locale?: string
}

function Mono({ value }: { value: string }) {
  return value ? <span className="font-mono text-xs break-all">{value}</span> : <EmDash />
}

export function WorkflowRunSheet({
  run,
  detail,
  isLoading = false,
  error = null,
  onRetry,
  retrying = false,
  onClose,
  locale,
}: WorkflowRunSheetProps) {
  const shown = detail ?? run
  const time = (value: Date | null) => (value ? formatDateTime(value, locale) : <EmDash />)

  const columns: SimpleColumn<WorkflowActivity>[] = [
    {
      key: 'activity',
      header: 'Activity',
      className: 'whitespace-normal',
      cell: (activity) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs break-all">{activity.name || '—'}</span>
          {activity.failureMessage ? (
            <span className="text-destructive text-xs break-words">{activity.failureMessage}</span>
          ) : null}
          {activity.failureTime ? (
            <span className="text-muted-foreground text-xs">
              Last failed {formatDateTime(activity.failureTime, locale)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (activity) =>
        activity.status ? (
          <Pill tone={statusTone(activity.status)}>
            {WORKFLOW_ACTIVITY_STATUS_LABEL[activity.status]}
          </Pill>
        ) : (
          <EmDash />
        ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      cell: (activity) => (
        <span className={cn('tabular-nums', activity.attempts > 1 && 'text-warning')}>
          {activity.attempts || <EmDash />}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (activity) =>
        activity.durationMs === null ? (
          <EmDash />
        ) : (
          <span className="text-muted-foreground">{formatDuration(activity.durationMs)}</span>
        ),
    },
  ]

  return (
    <Sheet open={run !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {shown ? (
          <>
            <SheetHeader>
              <SheetTitle>{shown.name || 'Workflow run'}</SheetTitle>
              <SheetDescription className="font-mono text-xs break-all">
                {shown.workflowId}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <DetailList
                items={[
                  {
                    label: 'Status',
                    value: shown.status ? (
                      <Pill tone={WORKFLOW_STATUS_TONE[shown.status]}>
                        {WORKFLOW_STATUS_LABEL[shown.status]}
                      </Pill>
                    ) : (
                      <EmDash />
                    ),
                  },
                  {
                    label: 'Duration',
                    value:
                      shown.durationMs === null ? <EmDash /> : formatDuration(shown.durationMs),
                  },
                  { label: 'Started', value: time(shown.startTime) },
                  { label: 'Ended', value: time(shown.closeTime) },
                  { label: 'Run ID', value: <Mono value={shown.id} /> },
                  ...(detail
                    ? [
                        { label: 'Workflow type', value: <Mono value={detail.type} /> },
                        { label: 'Task queue', value: <Mono value={detail.taskQueue} /> },
                      ]
                    : []),
                  ...(detail?.failureMessage
                    ? [
                        {
                          label: 'Failure',
                          full: true,
                          value: (
                            <span role="alert" className="text-destructive">
                              {detail.failureMessage}
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />

              <section className="flex flex-col gap-3" aria-label="Activities">
                <h3 className="text-sm font-medium">Activities</h3>
                {error && !retrying ? (
                  <div className="flex flex-col gap-3">
                    <p role="alert" className="text-destructive text-sm">
                      {error}
                    </p>
                    {onRetry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit px-3"
                        onClick={onRetry}
                      >
                        Try again
                      </Button>
                    ) : null}
                  </div>
                ) : !detail || isLoading || retrying ? (
                  <div className="flex flex-col gap-2" role="status" aria-label="Loading activities">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <SimpleTable
                      columns={columns}
                      rows={detail.activities}
                      empty="This run has not executed any activity yet."
                    />
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
