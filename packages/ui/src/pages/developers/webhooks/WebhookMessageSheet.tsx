import { useState } from 'react'
import { RotateCcwIcon } from '@ui/icons'
import type { WebhookAttempt, WebhookMessage } from '@fp/domain'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { Button } from '@ui/components/primitives/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EmDash } from '../../shared/cells'
import { WebhookStatusPill, WebhookTime, formatWebhookTime } from './webhookCells'

/**
 * One message: Svix's message page, as a sheet over whichever list opened it.
 *
 * The event type and when it was created, the payload exactly as it was sent,
 * and every delivery attempt: status, the endpoint URL, the HTTP status the
 * receiver answered with and how long it took, its response body, and the
 * `svix-id` / `svix-timestamp` headers the receiver saw. Each attempt can be
 * resent to its endpoint.
 */
export const WebhookMessageSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'reui/code-block'],
  note: 'Svix message detail: payload, attempts with response and webhook headers, resend.',
})

export interface WebhookMessageSheetProps {
  /** `null` closes the sheet. */
  message: WebhookMessage | null
  attempts: WebhookAttempt[]
  attemptsLoading?: boolean
  attemptsError?: string | null
  onClose: () => void
  /** Re-delivers the message to the attempt's endpoint. */
  onResend?: (attempt: WebhookAttempt) => Promise<unknown>
  locale?: string
}

export function WebhookMessageSheet({
  message,
  attempts,
  attemptsLoading = false,
  attemptsError = null,
  onClose,
  onResend,
  locale,
}: WebhookMessageSheetProps) {
  const [raw, setRaw] = useState(false)
  const payload = message
    ? raw
      ? JSON.stringify(message.payload)
      : JSON.stringify(message.payload, null, 2)
    : ''

  return (
    <Sheet open={message !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {message ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">{message.eventType || 'Message'}</SheetTitle>
              <SheetDescription>
                {message.timestamp
                  ? `Created ${formatWebhookTime(message.timestamp, locale)}`
                  : 'No timestamp on this message'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <DetailList
                items={[
                  {
                    label: 'Message ID',
                    value: <span className="font-mono text-xs">{message.id}</span>,
                  },
                  {
                    label: 'Event ID',
                    value: message.eventId ? (
                      <span className="font-mono text-xs">{message.eventId}</span>
                    ) : (
                      <EmDash />
                    ),
                  },
                ]}
              />
              <CodeBlock
                code={payload}
                language="json"
                label="Message payload"
                showLineNumbers={!raw}
              >
                <CodeBlockHeader>
                  <CodeBlockTitle>Payload</CodeBlockTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    aria-pressed={raw}
                    onClick={() => setRaw((value) => !value)}
                  >
                    {raw ? 'Formatted' : 'Raw'}
                  </Button>
                  <CodeBlockCopyButton />
                </CodeBlockHeader>
              </CodeBlock>

              <section className="flex flex-col gap-3" aria-label="Delivery attempts">
                <h3 className="text-sm font-medium">Delivery attempts</h3>
                {attemptsError ? (
                  <p role="alert" className="text-destructive text-sm">
                    {attemptsError}
                  </p>
                ) : attemptsLoading ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : attempts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No attempts yet. Delivery is queued, or no endpoint subscribes to this event
                    type.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {attempts.map((attempt) => (
                      <AttemptItem
                        key={attempt.id}
                        attempt={attempt}
                        {...(onResend ? { onResend } : {})}
                        {...(locale ? { locale } : {})}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function AttemptItem({
  attempt,
  onResend,
  locale,
}: {
  attempt: WebhookAttempt
  onResend?: (attempt: WebhookAttempt) => Promise<unknown>
  locale?: string
}) {
  const [resending, setResending] = useState(false)
  const unixSeconds = attempt.timestamp ? Math.floor(attempt.timestamp.getTime() / 1000) : null

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <WebhookStatusPill status={attempt.status} />
        <span
          title={attempt.url}
          className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs"
        >
          {attempt.url}
        </span>
        <span className="shrink-0 text-sm">
          <WebhookTime value={attempt.timestamp} locale={locale} />
        </span>
        {onResend ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resending}
            onClick={() => {
              setResending(true)
              void onResend(attempt).finally(() => setResending(false))
            }}
          >
            <RotateCcwIcon aria-hidden />
            {resending ? 'Resending…' : 'Resend'}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 border-t pt-3">
        <DetailList
          items={[
            {
              label: 'HTTP status',
              value: (
                <span
                  className={cn(
                    'font-mono text-xs',
                    attempt.responseStatusCode >= 400 || attempt.responseStatusCode === 0
                      ? 'text-destructive'
                      : '',
                  )}
                >
                  {attempt.responseStatusCode === 0 ? 'No response' : attempt.responseStatusCode}
                </span>
              ),
            },
            {
              label: 'Duration',
              value:
                attempt.responseDurationMs === null ? (
                  <EmDash />
                ) : (
                  `${attempt.responseDurationMs} ms`
                ),
            },
            {
              label: 'Trigger',
              value: attempt.trigger === 'manual' ? 'Manual resend' : 'Scheduled',
            },
            {
              label: 'svix-id',
              value: <span className="font-mono text-xs">{attempt.messageId}</span>,
            },
            {
              label: 'svix-timestamp',
              value:
                unixSeconds === null ? (
                  <EmDash />
                ) : (
                  <span className="font-mono text-xs">{unixSeconds}</span>
                ),
            },
          ]}
        />
        <CodeBlock
          code={attempt.response || '(empty response body)'}
          language="json"
          label={`Response body, attempt ${attempt.id}`}
        >
          <CodeBlockHeader>
            <CodeBlockTitle>Response body</CodeBlockTitle>
            <CodeBlockCopyButton className="ml-auto" />
          </CodeBlockHeader>
        </CodeBlock>
      </div>
    </li>
  )
}
