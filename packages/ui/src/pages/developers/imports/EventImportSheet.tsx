import type { EventImport } from '@fp/domain'
import { eventImportErrors, isEventImportActive } from '@fp/domain'
import { RefreshCwIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Properties } from '@ui/compositions/detail/DetailKit'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'
import { eventImportPill } from './eventImportStatus'

/**
 * One import: how far it got and, when rows were rejected, why.
 *
 * The backend reports failed rows as one summary string (`Record n: …` joined
 * by `; `); it is split back into a list so each row's reason reads on its own.
 */
export const EventImportSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'compositions/detail/DetailKit'],
  note: 'Read-only import detail: status, row counts, timings and per-row errors.',
})

/** Rows listed before the rest are summed up, so a large failure stays readable. */
const ERRORS_SHOWN = 50

export interface EventImportSheetProps {
  /** The import to show. `null` closes the sheet. */
  row: EventImport | null
  onClose: () => void
  /** Re-reads the import; shown while it is still queued or running. */
  onRefresh?: (() => void) | undefined
  isRefreshing?: boolean
  locale?: string
}

export function EventImportSheet({
  row,
  onClose,
  onRefresh,
  isRefreshing = false,
  locale,
}: EventImportSheetProps) {
  const number = (value: number | null) =>
    value === null ? '—' : new Intl.NumberFormat(locale).format(value)
  const stamp = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(value)
      : '—'
  const errors = row ? eventImportErrors(row.errorSummary) : []
  const pill = row ? eventImportPill(row) : null

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {row && pill ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.fileName || 'Untitled file'}</SheetTitle>
              <SheetDescription>Uploaded {stamp(row.createdAt)}</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <Pill tone={pill.tone}>{pill.label}</Pill>
                {onRefresh && isEventImportActive(row.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCwIcon aria-hidden className={cn(isRefreshing && 'animate-spin')} />
                    Refresh
                  </Button>
                ) : null}
              </div>
              <Properties
                columns={3}
                items={[
                  { label: 'Rows', value: number(row.totalRecords) },
                  { label: 'Imported', value: number(row.successfulRecords) },
                  { label: 'Failed', value: number(row.failedRecords) },
                ]}
              />
              <DetailList
                items={[
                  {
                    label: 'Import ID',
                    value: <span className="font-mono text-xs">{row.id || '—'}</span>,
                  },
                  { label: 'Started', value: stamp(row.startedAt) },
                  {
                    label: row.failedAt ? 'Failed' : 'Finished',
                    value: stamp(row.completedAt ?? row.failedAt),
                  },
                ]}
              />
              {errors.length > 0 ? (
                <section className="flex flex-col gap-2" aria-label="Errors">
                  <h3 className="text-sm font-medium">
                    {errors.length === 1 ? 'Error' : `${errors.length} errors`}
                  </h3>
                  <ul className="text-destructive flex flex-col gap-1 font-mono text-xs break-words">
                    {errors.slice(0, ERRORS_SHOWN).map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  {errors.length > ERRORS_SHOWN ? (
                    <p className="text-muted-foreground text-xs">
                      And {errors.length - ERRORS_SHOWN} more. Fix these rows and import them again.
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
