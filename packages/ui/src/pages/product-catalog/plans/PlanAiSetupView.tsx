import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react'
import {
  ArrowUpIcon,
  BlocksIcon,
  CheckIcon,
  CoinsIcon,
  FileTextIcon,
  GaugeIcon,
  LayersIcon,
  PlusIcon,
  ReceiptTextIcon,
  SparklesIcon,
  SquareStackIcon,
  TriangleAlertIcon,
  UsersIcon,
} from '@ui/icons'
import {
  PLAN_KIND_LABEL,
  type PricingSchema,
  pricingSchemaProblems,
  pricingSchemaTotals,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/components/primitives/empty'
import { Field, FieldGroup, FieldLabel, FieldTitle } from '@ui/components/primitives/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@ui/components/primitives/input-group'
import { Item, ItemContent, ItemMedia, ItemTitle } from '@ui/components/primitives/item'
import { Kbd } from '@ui/components/primitives/kbd'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/components/primitives/tooltip'
import { Frame, FrameFooter, FramePanel } from '@ui/components/reui/frame'
import { AppFailure } from '@ui/compositions/feedback/AppFailure'
import { provenance } from '@ui/provenance'
import { EmDash, Pill, Tag } from '../../shared/cells'

/**
 * Describe a pricing page; get a catalogue — on the ReUI `ai-chat-5` chat
 * layout.
 *
 * The block's parts, filled with this flow: a welcome over a composer (a
 * Frame whose panel is the box and whose footer says what happens next), and
 * chips under it that pick the kind of pricing to start from. Sending turns
 * the screen into a run: the description at the top with "Start over", a
 * panel of steps (reading, then creating) with the block's spinner and check
 * rows, and a second panel with the answer — here, everything the description
 * would create.
 *
 * The block cannot be used in place: it is hard-wired to its own demo
 * (sources, modes, a streamed answer), so this composes the same pieces,
 * as `FormToolbar` does with form-3.
 *
 * The split between reading and creating is the whole design and is kept. A
 * model reading a pricing page will sometimes invent a tier or miss a cap, so
 * what comes back is *not* applied: it is laid out as the features, plans,
 * prices, entitlements and grants it would create, and only a second,
 * explicit action writes any of it. Everything created is tagged
 * `created_with_ai` for exactly that reason.
 */
export const PlanAiSetupViewProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/frame',
    'ui/input-group',
    'ui/empty',
    'ui/item',
    'ui/radio-group',
    'ui/field',
    'ui/kbd',
    'ui/tooltip',
    'ui/spinner',
    'pages/shared/cells',
  ],
  note: 'ai-chat-5 layout (welcome, Frame composer, mode chips, run panel with step rows) for describe-then-review AI pricing setup. Lineage: blocks/ai-chat-5.',
})

export interface PlanAiSetupViewProps {
  description: string
  onDescriptionChange: (value: string) => void
  onParse: () => void
  isParsing: boolean
  parseError?: string | null

  /** What the parser answered, once it has. */
  schema?: PricingSchema | null
  onDiscard: () => void
  onApply: () => void
  isApplying: boolean
  applyError?: string | null
  /** Which step is running, for the progress line. */
  applyStep?: string | null

  onCancel: () => void
}

/** The kinds of pricing to start from: each sets the example the empty box shows. */
const STARTERS = [
  {
    id: 'usage',
    label: 'Usage-based',
    icon: <GaugeIcon aria-hidden />,
    example:
      'Starter is $29/month with 10,000 API calls included, then $0.01 per extra call. Pro is $99/month with 100,000 calls included, then $0.008 per call.',
  },
  {
    id: 'seats',
    label: 'Per seat',
    icon: <UsersIcon aria-hidden />,
    example:
      'Team is $12 per seat per month, minimum 3 seats. Business is $24 per seat per month with SSO and audit logs. Enterprise is custom, billed annually.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    icon: <BlocksIcon aria-hidden />,
    example:
      'Three plans. Starter is $29/month with 10,000 API calls included, then $0.01 per extra call. Pro is $99/month with 100,000 calls and 5 seats. Enterprise is custom, billed annually, with unlimited calls.',
  },
  {
    id: 'credits',
    label: 'Credits',
    icon: <CoinsIcon aria-hidden />,
    example:
      'Growth is $49/month and includes 5,000 credits every month. One image costs 4 credits and one minute of video costs 20. New accounts get 1,000 welcome credits.',
  },
] as const
type StarterId = (typeof STARTERS)[number]['id']

const COMPOSER_ID = 'plan-ai-setup-composer'

type StepState = 'running' | 'done' | 'failed'

function StepIcon({ state }: { state: StepState }) {
  if (state === 'running') return <Spinner className="size-4" />
  if (state === 'failed') return <TriangleAlertIcon aria-hidden className="text-warning size-4" />
  return <CheckIcon aria-hidden className="text-success size-4" />
}

/** One line of the run: what is happening, and whether it is done. */
function Step({ state, children }: { state: StepState; children: ReactNode }) {
  return (
    <Item size="xs" className="gap-2.5 px-2 py-1">
      <ItemMedia variant="icon" className="bg-transparent">
        <StepIcon state={state} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle
          data-muted={state !== 'done'}
          className="data-[muted=true]:text-muted-foreground truncate font-normal"
        >
          {children}
        </ItemTitle>
      </ItemContent>
    </Item>
  )
}

export function PlanAiSetupView({
  description,
  onDescriptionChange,
  onParse,
  isParsing,
  parseError = null,
  schema = null,
  onDiscard,
  onApply,
  isApplying,
  applyError = null,
  applyStep = null,
  onCancel,
}: PlanAiSetupViewProps) {
  const [starterId, setStarterId] = useState<StarterId>('hybrid')
  const starter = STARTERS.find((item) => item.id === starterId) ?? STARTERS[0]
  const field = useRef<HTMLTextAreaElement>(null)

  const problems = schema ? pricingSchemaProblems(schema) : []
  const totals = schema ? pricingSchemaTotals(schema) : null
  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const summary = totals
    ? [
        plural(totals.features, 'feature'),
        plural(totals.plans, 'plan'),
        plural(totals.prices, 'price'),
        plural(totals.entitlements, 'entitlement'),
        plural(totals.creditGrants, 'credit grant'),
      ].join(' · ')
    : null
  const canApply = schema !== null && problems.length === 0 && !isApplying
  const canSend = description.trim().length > 0 && !isParsing && !isApplying
  // A run is on screen once something was read, or is being read.
  const running = isParsing || schema !== null || parseError !== null

  const send = () => {
    if (canSend) onParse()
    else field.current?.focus()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line; an IME's Enter commits a word.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    send()
  }

  const composer = (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <FieldLabel className="sr-only" htmlFor={COMPOSER_ID}>
        Describe your pricing
      </FieldLabel>
      <Frame spacing="sm">
        <FramePanel fit className="bg-background p-0">
          <InputGroup className="bg-background rounded-(--frame-panel-radius) border-0">
            <InputGroupTextarea
              id={COMPOSER_ID}
              ref={field}
              value={description}
              // Read-only, not disabled: a disabled control fades the whole group.
              readOnly={isParsing || isApplying}
              aria-busy={isParsing || isApplying}
              onChange={(event) => onDescriptionChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={starter.example}
              className="placeholder:text-muted-foreground field-sizing-content max-h-60 min-h-20"
            />
            <InputGroupAddon align="block-end" className="gap-1">
              <InputGroupButton
                size="sm"
                className="rounded-full"
                onClick={() => {
                  if (isParsing || isApplying) return
                  onDescriptionChange(starter.example)
                  field.current?.focus()
                }}
              >
                <FileTextIcon aria-hidden />
                Use this example
              </InputGroupButton>
              <div className="ms-auto flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <InputGroupButton
                        type="submit"
                        size="icon-sm"
                        variant="default"
                        aria-label={schema ? 'Read it again' : 'Read my pricing'}
                        className="rounded-full"
                        // Never disabled, as in the block: a disabled control
                        // fades the whole group, and an empty send refocuses.
                        aria-disabled={!canSend}
                      />
                    }
                  >
                    <ArrowUpIcon aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent className="flex items-center gap-1.5">
                    {schema ? 'Read it again' : 'Read my pricing'}
                    <Kbd>Enter</Kbd>
                  </TooltipContent>
                </Tooltip>
              </div>
            </InputGroupAddon>
          </InputGroup>
        </FramePanel>
        <FrameFooter>
          <p className="text-muted-foreground px-1 text-xs">
            Paste a pricing page or write it out. Nothing is created until you have reviewed it.
          </p>
        </FrameFooter>
      </Frame>
    </form>
  )

  return (
    // Every tooltip on the screen needs this ancestor to open.
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-10 pb-16 sm:px-6">
        {running ? (
          <div className="flex flex-col gap-3 pb-3">
            <h1 className="sr-only">Create with AI</h1>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium text-pretty whitespace-pre-line">
                {description}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="-me-2"
                onClick={onDiscard}
                disabled={isApplying}
              >
                <PlusIcon aria-hidden />
                Start over
              </Button>
            </div>

            <Frame spacing="sm">
              <FramePanel fit className="flex flex-col py-1.5">
                <p aria-live="polite" className="text-muted-foreground px-2 pt-0.5 pb-1 text-xs">
                  {isParsing
                    ? 'Reading your pricing'
                    : isApplying
                      ? 'Creating your catalogue'
                      : parseError
                        ? 'Nothing was read'
                        : 'What this will create'}
                </p>
                <Step state={isParsing ? 'running' : parseError ? 'failed' : 'done'}>
                  {isParsing
                    ? 'Reading the description'
                    : parseError
                      ? 'The description could not be read'
                      : 'Read the description'}
                </Step>
                {schema && !isParsing ? (
                  <Step state={problems.length > 0 ? 'failed' : 'done'}>
                    {problems.length > 0
                      ? `${plural(problems.length, 'detail')} to fix before creating`
                      : 'Checked it can be created'}
                  </Step>
                ) : null}
                {isApplying ? <Step state="running">{`${applyStep ?? 'Creating'}…`}</Step> : null}
              </FramePanel>

              {isParsing ? (
                <FramePanel fit className="flex flex-col gap-3 py-4">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-9 w-full" />
                  ))}
                </FramePanel>
              ) : null}

              {schema && !isParsing ? (
                <FramePanel fit className="p-0">
                  {summary ? (
                    <p className="text-muted-foreground border-b px-4 py-2.5 text-xs">{summary}</p>
                  ) : null}
                  <SchemaReview schema={schema} />
                </FramePanel>
              ) : null}
            </Frame>

            {parseError ? (
              <AppFailure title="That could not be read" detail={parseError} onRetry={onParse} />
            ) : null}

            {problems.length > 0 ? (
              <Frame spacing="sm">
                <FramePanel fit className="py-3">
                  <p className="mb-2 text-sm font-medium">These have to be fixed first</p>
                  <ul className="text-destructive flex list-disc flex-col gap-1.5 pl-5 text-sm">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-3 text-[13px]">
                    Add the missing detail to the description below and read it again.
                  </p>
                </FramePanel>
              </Frame>
            ) : null}

            {applyError ? (
              <AppFailure
                title="Some of that could not be created"
                detail={applyError}
                onRetry={onApply}
              />
            ) : null}

            {schema && !isParsing ? (
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
                  Cancel
                </Button>
                <Button onClick={onApply} disabled={!canApply}>
                  <SquareStackIcon aria-hidden />
                  {isApplying ? 'Creating…' : 'Create all of this'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <Empty className="flex-none gap-0 pb-10">
            <EmptyHeader className="max-w-md gap-4">
              <EmptyMedia
                variant="icon"
                className="bg-primary text-primary-foreground size-10 rounded-lg"
              >
                <SparklesIcon aria-hidden className="size-5" />
              </EmptyMedia>
              <EmptyTitle role="heading" aria-level={1} className="text-2xl tracking-tight">
                Create with AI
              </EmptyTitle>
              <EmptyDescription>
                Describe how you charge and this drafts the features, plans and prices. Nothing is
                created until you have read it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {composer}

        {/* The chips steer the next description, so a run hides them. */}
        {running ? null : (
          <div className="mt-4 flex flex-col items-center gap-4">
            <RadioGroup
              value={starterId}
              onValueChange={(next: StarterId) => setStarterId(next)}
              aria-label="Kind of pricing"
              // The group's own grid would stack the chips; they sit in a row.
              className="flex w-full flex-row flex-wrap justify-center gap-x-2 gap-y-4"
              render={<FieldGroup className="flex-row flex-wrap justify-center gap-x-2 gap-y-4" />}
            >
              {STARTERS.map((item) => {
                const fieldId = `${COMPOSER_ID}-${item.id}`
                return (
                  <FieldLabel
                    key={item.id}
                    htmlFor={fieldId}
                    className="has-data-checked:border-primary/50 has-data-checked:bg-primary/5 dark:has-data-checked:bg-primary/10 has-[:focus-visible]:ring-ring/50 relative w-auto! cursor-pointer p-0 transition-colors has-[:focus-visible]:ring-[3px]"
                  >
                    <Field orientation="horizontal" className="h-8 px-3 py-0">
                      <RadioGroupItem id={fieldId} value={item.id} className="sr-only" />
                      <FieldTitle className="gap-1.5 [&_svg]:size-3.5">
                        {item.icon}
                        {item.label}
                      </FieldTitle>
                    </Field>
                  </FieldLabel>
                )
              })}
            </RadioGroup>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

/** Everything the description would create, grouped: features, plans, credit grants. */
function SchemaReview({ schema }: { schema: PricingSchema }) {
  return (
    <div className="flex flex-col divide-y">
      <SchemaGroup
        icon={<GaugeIcon aria-hidden className="size-4" />}
        title="Features"
        count={schema.features.length}
        empty="No features."
      >
        {schema.features.map((feature) => (
          <Row
            key={feature.key}
            name={feature.name}
            hint={feature.key}
            value={
              <span className="flex items-center gap-2">
                <Tag>{feature.type === 'metered' ? 'Metered' : 'Static'}</Tag>
                {feature.type === 'metered' ? (
                  <span className="text-muted-foreground text-xs">
                    {feature.aggregation === 'sum'
                      ? `SUM of ${feature.aggregationField ?? '—'}`
                      : 'COUNT'}{' '}
                    on {feature.eventName}
                  </span>
                ) : null}
              </span>
            }
          />
        ))}
      </SchemaGroup>

      <SchemaGroup
        icon={<LayersIcon aria-hidden className="size-4" />}
        title="Plans"
        count={schema.plans.length}
        empty="No plans."
      >
        {schema.plans.map((plan) => (
          <div key={plan.name} className="flex flex-col gap-2 px-6 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{plan.name}</span>
                {plan.description ? (
                  <span className="text-muted-foreground text-xs">{plan.description}</span>
                ) : null}
              </div>
              <Pill>
                {
                  PLAN_KIND_LABEL[
                    plan.prices.length > 0 && plan.usageCharges.length > 0
                      ? 'hybrid'
                      : plan.usageCharges.length > 0
                        ? 'usage'
                        : plan.prices.length > 0
                          ? 'flat'
                          : 'empty'
                  ]
                }
              </Pill>
            </div>
            <ul className="text-muted-foreground flex flex-col gap-1 text-[13px]">
              {plan.prices.map((price, index) => (
                <li key={`price-${index}`} className="tabular-nums">
                  {price.currency} {price.amount} / {price.billingPeriod}
                </li>
              ))}
              {plan.usageCharges.map((charge, index) => (
                <li key={`usage-${index}`} className="tabular-nums">
                  {charge.currency} {charge.amountPerUnit}{' '}
                  {charge.billingModel === 'package'
                    ? `per ${charge.packageSize?.toLocaleString() ?? '—'}`
                    : 'per unit'}{' '}
                  of {charge.featureKey}
                </li>
              ))}
              {plan.entitlements.map((entitlement) => (
                <li key={entitlement.featureKey} className="flex items-center gap-1.5">
                  <CheckIcon aria-hidden className="text-success size-3.5 shrink-0" />
                  {entitlement.featureKey}:{' '}
                  {entitlement.isUnlimited
                    ? 'unlimited'
                    : (entitlement.value?.toLocaleString() ?? '—')}
                </li>
              ))}
              {plan.prices.length === 0 &&
              plan.usageCharges.length === 0 &&
              plan.entitlements.length === 0 ? (
                <li>
                  <EmDash />
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </SchemaGroup>

      {schema.creditGrants.length > 0 ? (
        <SchemaGroup
          icon={<ReceiptTextIcon aria-hidden className="size-4" />}
          title="Credit grants"
          count={schema.creditGrants.length}
          empty="No credit grants."
        >
          {schema.creditGrants.map((grant, index) => (
            <Row
              key={`${grant.planName}-${index}`}
              name={grant.name}
              hint={`on ${grant.planName}`}
              value={
                <span className="tabular-nums">
                  {grant.credits.toLocaleString()}{' '}
                  {grant.cadence === 'recurring' ? `/ ${grant.period}` : 'once'}
                </span>
              }
            />
          ))}
        </SchemaGroup>
      ) : null}
    </div>
  )
}

function SchemaGroup({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: ReactNode
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="bg-muted/60 flex items-center gap-3 border-b px-6 py-2.5">
        <span className="text-muted-foreground flex size-6 items-center justify-center">
          {icon}
        </span>
        <span className="text-[13px] font-medium">{title}</span>
        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground px-6 py-4 text-[13px]">{empty}</p>
      ) : (
        <div className="divide-border/50 flex flex-col divide-y">{children}</div>
      )}
    </section>
  )
}

function Row({ name, hint, value }: { name: string; hint?: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{name}</span>
        {hint ? <span className="text-muted-foreground font-mono text-xs">{hint}</span> : null}
      </div>
      <div className="shrink-0 text-right">{value}</div>
    </div>
  )
}
