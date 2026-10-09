import type { RawEvent } from '@fp/domain'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { DetailList } from '@ui/compositions/tables/DetailList'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { provenance } from '@ui/provenance'

/**
 * One raw event, opened from the Events Debugger list.
 *
 * The properties render as the JSON the sender attached, in the ReUI
 * `CodeBlock` unchanged — a debugger's whole point is seeing the payload
 * verbatim, so nothing here reformats or interprets it.
 */
export const EventDetailSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'reui/code-block'],
  note: 'Read-only event detail: identifying fields plus the verbatim properties payload.',
})

export interface EventDetailSheetProps {
  /** The event to show. `null` closes the sheet. */
  event: RawEvent | null
  onClose: () => void
  locale?: string
}

export function EventDetailSheet({ event, onClose, locale }: EventDetailSheetProps) {
  const payload = event ? JSON.stringify(event.properties, null, 2) : ''

  return (
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {event ? (
          <>
            <SheetHeader>
              <SheetTitle>{event.eventName || 'Event'}</SheetTitle>
              <SheetDescription>
                {event.timestamp
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                      timeStyle: 'medium',
                    }).format(event.timestamp)
                  : 'No timestamp on this event'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <DetailList
                items={[
                  {
                    label: 'Event ID',
                    value: <span className="font-mono text-xs">{event.id || '—'}</span>,
                  },
                  { label: 'Source', value: event.source || '—' },
                  {
                    label: 'Customer ID',
                    value: (
                      <span className="font-mono text-xs">{event.externalCustomerId || '—'}</span>
                    ),
                  },
                  {
                    label: 'Flexprice customer',
                    value: (
                      <span className="font-mono text-xs">{event.customerId || 'Not matched'}</span>
                    ),
                  },
                ]}
              />
              <CodeBlock code={payload} language="json" showLineNumbers>
                <CodeBlockHeader>
                  <CodeBlockTitle>Properties</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
