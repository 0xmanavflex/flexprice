import type { ReactNode } from 'react'
import { DownloadIcon } from '@ui/icons'
import { EVENT_IMPORT_COLUMNS, type EventImportColumn, eventImportTemplateCsv } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { PageBody } from '@ui/compositions/layout/Page'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'

/**
 * The Imports landing page: the CSV format an import expects, with a template
 * to start from, then every import (`children`, the page's list).
 *
 * The columns are the backend's contract (`EventsChunkProcessor`), so the table
 * and the template come from one list in `@fp/domain`.
 */
export const EventImportsOverviewProvenance = provenance({
  source: 'composition',
  composes: ['compositions/layout/Section', 'compositions/detail/DetailKit'],
  note: 'Event CSV format and template download above the imports list.',
})

export const EVENT_IMPORT_TEMPLATE_FILE = 'flexprice-events-template.csv'

/** Saves the template. No byte-order mark: the importer reads the first header by name. */
export function downloadEventImportTemplate(): void {
  const url = URL.createObjectURL(
    new Blob([eventImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = EVENT_IMPORT_TEMPLATE_FILE
  link.click()
  URL.revokeObjectURL(url)
}

export interface EventImportsOverviewProps {
  /** Replaces the default template download, e.g. in a story. */
  onDownloadTemplate?: () => void
  children: ReactNode
}

export function EventImportsOverview({
  onDownloadTemplate = downloadEventImportTemplate,
  children,
}: EventImportsOverviewProps) {
  return (
    <PageBody>
      <div className="flex flex-col gap-6">
        {children}
        <Section
          table
          title="CSV format"
          description="One event per row. Headers are matched by name, in any order; other columns are ignored."
          action={
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={onDownloadTemplate}>
              <DownloadIcon aria-hidden />
              Download template
            </Button>
          }
        >
          <SimpleTable<EventImportColumn>
            rows={[...EVENT_IMPORT_COLUMNS]}
            getRowId={(column) => column.name}
            columns={[
              {
                key: 'name',
                header: 'Column',
                cell: (column) => <span className="font-mono text-xs">{column.name}</span>,
              },
              {
                key: 'required',
                header: 'Required',
                cell: (column) =>
                  column.required ? <Pill tone="info">Required</Pill> : <Pill>Optional</Pill>,
              },
              {
                key: 'description',
                header: 'What it holds',
                cell: (column) => (
                  <span className="text-muted-foreground">{column.description}</span>
                ),
              },
            ]}
          />
        </Section>
      </div>
    </PageBody>
  )
}
