import {
  EVENT_DEBUG_STAGE_LABEL,
  EVENT_DEBUG_STAGE_WIRE,
  type EventDebug,
  type EventDebugStageResult,
  eventDebugSummary,
  missingAggregationFields,
} from '@fp/domain'
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  MinusIcon,
  TriangleAlertIcon,
} from '@ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The five stages an event goes through, and where it stopped.
 *
 * This is what makes the Events page a debugger rather than a log. The list
 * answers "did it arrive"; nobody opens it to ask that. They open it because
 * an invoice is wrong, and the question is which of five things did not
 * happen: the customer was not matched, no meter listens for the name, the
 * meter has no price, no contract carries the price, or the quantity was
 * never counted. Each of those is somebody else's afternoon to find by hand.
 *
 * Stages after a failure are drawn as skipped, not failed: they did not run,
 * and showing five red rows would hide which one is the actual problem.
 */
export const EventTraceProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'The five-stage event pipeline with its failure point, from GET /events/lookup.',
})

export interface EventTraceProps {
  debug: EventDebug | undefined
  locale?: string | undefined
  isPending: boolean
  error?: string | null
  onRetry?: (() => void) | undefined
  /** Opens a contract the event was matched to. */
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  /** The event's properties: a meter that reads a field the event lacks is flagged. */
  properties?: Record<string, unknown> | undefined
}

export function EventTrace({
  debug,
  isPending,
  error = null,
  onRetry,
  onOpenSubscription,
  locale,
  properties,
}: EventTraceProps) {
  if (isPending) {
    return (
      <section className="flex flex-col gap-3" aria-label="Loading the trace">
        <Skeleton className="h-4 w-56" />
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-9 w-full" />
        ))}
      </section>
    )
  }

  if (error) {
    return (
      <section className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-lg border px-4 py-3">
        <p className="text-sm font-medium">This event could not be traced</p>
        <p className="text-muted-foreground text-xs">{error}</p>
        {onRetry ? (
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </section>
    )
  }

  if (!debug) return null

  const failed = debug.failurePoint !== null
  const missing = properties ? missingAggregationFields(debug, properties) : []

  return (
    <section className="flex flex-col gap-3" aria-label="Event trace">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">What happened to this event</h3>
        <p className={cn('text-[13px]', failed ? 'text-destructive' : 'text-muted-foreground')}>
          {eventDebugSummary(debug)}
        </p>
      </div>
      {missing.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>
            {missing.length === 1
              ? `This event has no "${missing[0]!.field}" property`
              : 'This event is missing properties its meters read'}
          </AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-0.5">
              {missing.map((item) => (
                <li key={`${item.meterId}:${item.field}`}>
                  {item.meterName} takes the {item.aggregation.toLowerCase()} of{' '}
                  <code className="font-mono">{item.field}</code>, so this event adds nothing to it.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <ol className="divide-border/60 flex flex-col divide-y rounded-lg border">
        {/*
          Where the trace starts.
          The five stages are things Flexprice did *after* the event landed,
          so without this row the list silently assumes the event arrived:
          which is the first thing to confirm when nothing else makes sense.
        */}
        <li className="flex gap-3 px-4 py-3">
          <CheckIcon aria-label="Passed" className="text-success mt-0.5 size-4 shrink-0" />
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
            <span className="text-sm font-medium">Ingested</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {debug.ingestedAt
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  }).format(debug.ingestedAt)
                : 'Time unknown'}
            </span>
          </div>
        </li>
        {debug.stages.map((stage) => (
          <Stage
            key={stage.stage}
            result={stage}
            isFailurePoint={debug.failurePoint === stage.stage}
            {...(onOpenSubscription ? { onOpenSubscription } : {})}
          />
        ))}
      </ol>
    </section>
  )
}

function Stage({
  result,
  isFailurePoint,
  onOpenSubscription,
}: {
  result: EventDebugStageResult
  isFailurePoint: boolean
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
}) {
  return (
    <li className={cn('flex gap-3 px-4 py-3', isFailurePoint && 'bg-destructive/5')}>
      <StageIcon outcome={result.outcome} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{EVENT_DEBUG_STAGE_LABEL[result.stage]}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {result.outcome === 'skipped' ? 'Not reached' : result.status}
          </span>
        </div>

        {/*
          `destructive-foreground` (red-800), not `destructive` (red-600):
          at 12px on the tinted failure row the brighter one is 4.36:1,
          just under AA. The darker token exists for small text on these
          backgrounds.
        */}
        {result.error ? (
          <p className="text-destructive-foreground text-xs">{result.error}</p>
        ) : null}

        {result.matches.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {result.matches.map((match) => (
              <li key={match.id} className="flex items-baseline gap-2 text-[13px]">
                {match.subscriptionId && onOpenSubscription ? (
                  <button
                    type="button"
                    className="truncate underline-offset-2 hover:underline"
                    onClick={() => onOpenSubscription(match.subscriptionId as string)}
                  >
                    {match.label}
                  </button>
                ) : (
                  <span className="truncate">{match.label}</span>
                )}
                {match.hint ? (
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      match.coversEvent === false
                        ? 'text-destructive-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {match.hint}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          The stage's own response.
          `<details>` rather than a built accordion: it is keyboard and screen
          reader accessible with no component behind it, and this is exactly
          the disclosure it is for.
        */}
        {Object.keys(result.raw).length > 0 ? (
          <details className="group mt-1">
            <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1 text-xs select-none">
              <ChevronRightIcon
                aria-hidden
                className="size-3 transition-transform group-open:rotate-90"
              />
              Response
            </summary>
            <div className="mt-2">
              {/*
                A unique `label`: it becomes the viewport's `aria-label`, and
                six regions all called "json code" is an axe `landmark-unique`
                failure as well as useless to anyone navigating by landmark.
              */}
              <CodeBlock
                code={JSON.stringify(result.raw, null, 2)}
                language="json"
                label={`${EVENT_DEBUG_STAGE_WIRE[result.stage]} response`}
              >
                <CodeBlockHeader>
                  <CodeBlockTitle>{EVENT_DEBUG_STAGE_WIRE[result.stage]}</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>
            </div>
          </details>
        ) : null}
      </div>
    </li>
  )
}

function StageIcon({ outcome }: { outcome: EventDebugStageResult['outcome'] }) {
  if (outcome === 'passed') {
    return <CheckIcon aria-label="Passed" className="text-success mt-0.5 size-4 shrink-0" />
  }
  if (outcome === 'failed') {
    return (
      <CircleAlertIcon aria-label="Failed" className="text-destructive mt-0.5 size-4 shrink-0" />
    )
  }
  return (
    <MinusIcon
      aria-label="Not reached"
      className="text-muted-foreground/60 mt-0.5 size-4 shrink-0"
    />
  )
}
