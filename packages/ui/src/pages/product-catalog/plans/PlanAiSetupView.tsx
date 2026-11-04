import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowUpIcon, CheckIcon, CircleCheckIcon, CoinsIcon, XIcon } from '@ui/icons'
import {
  type PricingFeature,
  type PricingPlan,
  type PricingSchema,
  moneyFormatLocale,
  pricingSchemaProblems,
} from '@fp/domain'
import { AI_TEMPLATE_LOGOS } from '@ui/assets/ai-templates'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@ui/components/primitives/input-group'
import { Kbd } from '@ui/components/primitives/kbd'
import { Spinner } from '@ui/components/primitives/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/components/primitives/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Frame, FrameFooter, FramePanel } from '@ui/components/reui/frame'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { AppFailure } from '@ui/compositions/feedback/AppFailure'
import { Section } from '@ui/compositions/layout/Section'
import { usePublishDetailTrail } from '@ui/compositions/shell/ShellDetailTrail'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'

/**
 * Create with AI: describe a pricing model, review the draft, create it.
 *
 * The reference's four states, on the ReUI `ai-chat-5` parts:
 *
 * 1. **Prompt**: "Set up your pricing" over the block's composer (a Frame
 *    whose panel is the box, whose footer says how to write in it), on a
 *    dotted ground, with five templates under it. A template fills the box
 *    and sits in it as a chip.
 * 2. **Drafting**: the review header, a skeleton of the canvas, and a
 *    progress card stepping through the draft.
 * 3. **Review**: the draft as plan cards (price, usage, what is included,
 *    credits), then the features and meters and the credit grants it creates.
 * 4. **Creating**: the canvas blurs under a progress card that follows the
 *    real write, then says what was created.
 *
 * Nothing is written until "Create all of this": a model reading a pricing
 * page will sometimes invent a tier or miss a cap, and everything created is
 * tagged `created_with_ai` for that reason.
 *
 * The reference's model menu (Auto / Gemini 2.5 Pro / Flash) is left out:
 * `POST /ai/pricing/parse-gemini` takes no model, so it would change nothing.
 */
export const PlanAiSetupViewProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/frame',
    'reui/badge',
    'reui/alert',
    'ui/input-group',
    'ui/kbd',
    'ui/tooltip',
    'ui/spinner',
    'compositions/detail-kit',
    'compositions/section',
    'compositions/app-failure',
    'compositions/shell-detail-trail',
    'pages/shared/cells',
  ],
  note: 'Create with AI as the reference: prompt on the ai-chat-5 composer with templates, drafting skeleton + progress card, plan-card review canvas, creating overlay. Lineage: blocks/ai-chat-5.',
})

/** Which part of the catalogue is being written, in order. */
export type PlanAiCreateStep =
  'features' | 'plans' | 'prices' | 'entitlements' | 'creditGrants' | 'done'

export interface PlanAiSetupViewProps {
  description: string
  onDescriptionChange: (value: string) => void
  /**
   * Reads the description it is given, so an empty send can use the example.
   * `templateId` is set when a template was picked and sent unchanged: as in
   * V1, that template's own schema is used and the model is not asked.
   */
  onParse: (description: string, templateId?: string) => void
  isParsing: boolean
  parseError?: string | null

  /** What the parser answered, once it has. */
  schema?: PricingSchema | null
  /** Back to the prompt, keeping what was typed. */
  onDiscard: () => void
  onApply: () => void
  isApplying: boolean
  applyError?: string | null
  /** The part being written while creating. */
  createStep?: PlanAiCreateStep | null
  /** Everything was created: the card says so before the page moves on. */
  created?: boolean

  /** Back to Plans. */
  onCancel: () => void
}

const DEFAULT_PROMPT =
  'My app has a free plan and a pro plan at $20/month with 500 API calls included'

interface Template {
  id: keyof typeof AI_TEMPLATE_LOGOS
  label: string
  kind: string
  prompt: string
}

const TEMPLATES: Template[] = [
  {
    id: 'railway',
    label: 'Railway',
    kind: 'Infra',
    prompt: `Please build me Railway's pricing. This is a credit-based system where 1 credit = $0.01.

Resource costs (in credits):
- Memory: 0.040 credits per GB-hour
- CPU: 0.078 credits per vCPU-hour
- Egress: 5 credits per GB
- Storage: 1.5 credits per GB-month

Plans:
- Free: $0/month, 500 credits one-time grant ($5 equivalent)
- Hobby: $5/month, includes 500 credits per month
- Pro: $20/month, includes 2,000 credits per month`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    kind: 'Agentic AI',
    prompt: `Please build me Cursor's pricing.

- Free plan: 50 agent requests/month, 200 tab completions/month. Overage at $0.08/request and $0.01/completion.
- Pro at $20/month: 500 agent requests/month, unlimited tab completions. Overage at $0.04/request.
- Pro+ at $60/month: 1,500 agent requests/month (3x Pro), unlimited tab completions. Overage at $0.03/request.
- Ultra at $200/month: 10,000 agent requests/month (20x Pro), unlimited tab completions. Overage at $0.02/request.`,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    kind: 'Model Provider',
    prompt: `Please build me Google Gemini's API pricing.

There is a free tier with free input and output tokens on Gemini 2.5 Flash-Lite and Gemini 2.5 Flash.

- Gemini 3.1 Pro at $2.00 per 1M input tokens and $12.00 per 1M output tokens.
- Gemini 2.5 Pro at $1.25 per 1M input tokens and $10.00 per 1M output tokens.
- Gemini 2.5 Flash at $0.30 per 1M input tokens and $2.50 per 1M output tokens.
- Gemini 2.5 Flash-Lite at $0.10 per 1M input tokens and $0.40 per 1M output tokens.`,
  },
  {
    id: 'apollo',
    label: 'Apollo',
    kind: 'Credits + Sales',
    prompt: `Please build me Apollo.io-style credit-based pricing.

- Starter at $49/month with 1,200 credits per month.
- Professional at $99/month with 3,000 credits per month.
- Organization at $149/month with 6,000 credits per month.

Credits are consumed per action:
- Contact search: 1 credit
- Email unlock: 1 credit
- Phone reveal: 10 credits
- Contact export: 5 credits`,
  },
  {
    id: 'vapi',
    label: 'Vapi',
    kind: 'Voice AI',
    prompt: `Please build me Vapi's pricing.

Single plan: Vapi Pay As You Go ($0/month platform fee).

- $10 in starter credits (one-time): 1 credit = $0.01
- Hosting: 5 credits per call minute ($0.05), 0.5 credits per SMS/chat message ($0.005)
- Provider STT, LLM, TTS metered at cost in credits
- 10 concurrency lines included; Custom SIP and Custom Channels off by default`,
  },
]

const DRAFT_STEPS = [
  'Reading the description',
  'Drafting features and meters',
  'Drafting plans and prices',
  'Checking it can be created',
]
const CREATE_STEPS = [
  'Setting up features',
  'Creating plans',
  'Adding prices',
  'Applying limits',
  'Adding credits',
]
const CREATE_STEP_INDEX: Record<PlanAiCreateStep, number> = {
  features: 0,
  plans: 1,
  prices: 2,
  entitlements: 3,
  creditGrants: 4,
  done: 5,
}
/** How long the draft dwells on a step while the parser works. */
const STEP_MS = 750

/* ---- the draft, as plan cards ------------------------------------------- */

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(moneyFormatLocale(currency), {
      style: 'currency',
      currency: currency.toUpperCase() || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const PERIOD: Record<string, string> = { monthly: 'month', annual: 'year' }

function grantAmount(credits: number, cadence: string, period: string | null): string {
  const n = credits.toLocaleString('en-US')
  return cadence === 'recurring' ? `${n} / ${PERIOD[period ?? 'monthly'] ?? 'month'}` : `${n} once`
}

interface Line {
  label: string
  value: string
}

interface PlanCardData {
  name: string
  kind: string
  price: string
  period: string | null
  description: string
  hasUsage: boolean
  credits: string[]
  usage: Line[]
  included: Line[]
}

function toPlanCard(plan: PricingPlan, schema: PricingSchema): PlanCardData {
  const feature = (key: string): PricingFeature | undefined =>
    schema.features.find((f) => f.key === key)
  const first = plan.prices[0]
  const flatTotal = plan.prices.reduce((sum, price) => sum + price.amount, 0)
  const hasUsage = plan.usageCharges.length > 0
  const kind =
    plan.prices.length === 0
      ? hasUsage
        ? 'Usage'
        : 'Custom'
      : flatTotal === 0
        ? 'Free'
        : hasUsage
          ? 'Hybrid'
          : 'Flat'
  return {
    name: plan.name,
    kind,
    price: first ? money(first.amount, first.currency) : hasUsage ? money(0, 'USD') : 'Custom',
    period: first
      ? (PERIOD[first.billingPeriod] ?? first.billingPeriod)
      : hasUsage
        ? 'month'
        : null,
    description: plan.description,
    hasUsage,
    credits: schema.creditGrants
      .filter((grant) => grant.planName === plan.name)
      .map((grant) =>
        grantAmount(grant.credits, grant.cadence, grant.period).replace(/^([\d,.]+)/, '$1 credits'),
      ),
    usage: plan.usageCharges.map((charge) => {
      const f = feature(charge.featureKey)
      const unit = f?.unitSingular || 'unit'
      const per =
        charge.billingModel === 'package' && charge.packageSize
          ? `${charge.packageSize.toLocaleString('en-US')} ${f?.unitPlural || 'units'}`
          : unit
      return {
        label: charge.displayName || f?.name || charge.featureKey,
        value: `${money(charge.amountPerUnit, charge.currency)} / ${per}`,
      }
    }),
    included: plan.entitlements.map((entitlement) => {
      const f = feature(entitlement.featureKey)
      const value = entitlement.isUnlimited
        ? 'Unlimited'
        : entitlement.value === null
          ? 'Included'
          : `${entitlement.value.toLocaleString('en-US')}${
              f?.unitPlural
                ? ` ${entitlement.value === 1 ? f.unitSingular || f.unitPlural : f.unitPlural}`
                : ''
            }`
      return { label: f?.name || entitlement.featureKey, value }
    }),
  }
}

function CardList({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-t px-4 py-3">
      <p className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {title}
      </p>
      <ul className="flex flex-col">
        {lines.map((line) => (
          <li
            key={line.label}
            className="flex items-baseline justify-between gap-3 text-xs leading-5"
          >
            <span className="shrink-0">{line.label}</span>
            <span className="text-muted-foreground min-w-0 text-right tabular-nums">
              {line.value === 'Included' ? (
                <CheckIcon aria-label="Included" className="text-success inline size-3.5" />
              ) : (
                line.value
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlanCard({ plan }: { plan: PlanCardData }) {
  return (
    <article className="bg-background flex h-full flex-col rounded-xl border shadow-xs">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{plan.name}</h2>
          <Badge variant="outline" size="sm" className="shrink-0">
            {plan.kind}
          </Badge>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1 tabular-nums">
          <span className="text-xl font-medium tracking-tight">{plan.price}</span>
          {plan.period ? (
            <span className="text-muted-foreground text-xs">/ {plan.period}</span>
          ) : null}
          {plan.hasUsage ? (
            <Badge variant="info-light" size="sm" className="ml-1 self-center">
              + usage
            </Badge>
          ) : null}
        </p>
        {plan.description ? (
          <p className="text-muted-foreground text-xs">{plan.description}</p>
        ) : null}
        {plan.credits.map((credits) => (
          <p
            key={credits}
            className="bg-muted/60 text-foreground mt-1 flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums"
          >
            <CoinsIcon aria-hidden className="text-muted-foreground size-3" />
            {credits}
          </p>
        ))}
      </div>
      {plan.usage.length > 0 ? <CardList title="Usage" lines={plan.usage} /> : null}
      {plan.included.length > 0 ? <CardList title="Included" lines={plan.included} /> : null}
    </article>
  )
}

const GRID: Record<number, string> = {
  1: 'md:max-w-sm',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
}

function Draft({ schema }: { schema: PricingSchema }) {
  const plans = schema.plans.map((plan) => toPlanCard(plan, schema))
  const usedIn = (key: string) =>
    schema.plans
      .filter(
        (plan) =>
          plan.entitlements.some((e) => e.featureKey === key) ||
          plan.usageCharges.some((c) => c.featureKey === key),
      )
      .map((plan) => plan.name)
  const features = schema.features.map((feature) => ({ ...feature, id: feature.key }))
  const grants = schema.creditGrants.map((grant, index) => ({
    ...grant,
    id: `${grant.planName}-${grant.name}-${index}`,
  }))
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className={cn('grid items-stretch gap-4', GRID[Math.min(plans.length, 4)] ?? GRID[4])}>
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </div>
      <Section
        title="Features and meters"
        description="What gets created and metered for these plans."
        flush
        table
        showTitle
      >
        <SimpleTable
          rows={features}
          columns={[
            {
              key: 'name',
              header: 'Feature',
              className: 'w-56',
              cell: (row) => <span className="font-medium">{row.name}</span>,
            },
            {
              key: 'key',
              header: 'Lookup key',
              className: 'w-48',
              cell: (row) => <span className="font-mono text-xs">{row.key}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              className: 'w-28',
              cell: (row) => <Pill>{row.type === 'metered' ? 'Metered' : 'Static'}</Pill>,
            },
            {
              key: 'aggregation',
              header: 'Aggregation',
              className: 'w-48',
              cell: (row) => (
                <span className="text-muted-foreground">
                  {row.type !== 'metered'
                    ? '—'
                    : row.aggregation === 'sum'
                      ? `SUM of ${row.aggregationField ?? '—'}`
                      : 'COUNT'}
                </span>
              ),
            },
            {
              key: 'usedIn',
              header: 'Used in',
              className: 'w-56',
              cell: (row) => (
                <span className="text-muted-foreground">{usedIn(row.key).join(', ') || '—'}</span>
              ),
            },
          ]}
        />
      </Section>
      {grants.length > 0 ? (
        <Section
          title="Credit grants"
          description="Credits each plan hands out."
          flush
          table
          showTitle
        >
          <SimpleTable
            rows={grants}
            columns={[
              {
                key: 'name',
                header: 'Credit grant',
                className: 'w-56',
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                key: 'plan',
                header: 'Plan',
                className: 'w-48',
                cell: (row) => <span className="text-muted-foreground">{row.planName}</span>,
              },
              {
                key: 'credits',
                header: 'Credits',
                className: 'w-48',
                cell: (row) => (
                  <span className="tabular-nums">
                    {grantAmount(row.credits, row.cadence, row.period)}
                  </span>
                ),
              },
            ]}
          />
        </Section>
      ) : null}
    </div>
  )
}

/* ---- loading and progress ------------------------------------------------ */

function DraftSkeleton({ count }: { count: number }) {
  const bar = 'bg-muted rounded-sm'
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8" aria-hidden>
      <div className={cn('grid items-stretch gap-4', GRID[Math.min(count, 4)] ?? GRID[4])}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="ai-sweep bg-background flex h-full min-h-80 flex-col rounded-xl border shadow-xs"
          >
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className={cn(bar, 'h-3.5 w-20')} />
                <span className={cn(bar, 'h-4 w-14 rounded-md')} />
              </div>
              <span className={cn(bar, 'h-6 w-28')} />
              <span className={cn(bar, 'h-3 w-4/5')} />
              <span className={cn(bar, 'h-6 w-32 rounded-md')} />
            </div>
            {[3, 4].map((rows, block) => (
              <div key={block} className="flex flex-col gap-2.5 border-t px-4 py-3">
                <span className={cn(bar, 'h-2 w-12')} />
                {Array.from({ length: rows }, (_, row) => (
                  <div key={row} className="flex justify-between gap-6">
                    <span className={cn(bar, 'h-3 w-24')} />
                    <span className={cn(bar, 'h-3 w-12')} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="ai-sweep bg-background flex flex-col rounded-xl border shadow-xs">
        <div className="border-b px-4 py-3">
          <span className={cn(bar, 'block h-3.5 w-36')} />
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex gap-10 border-b px-4 py-3 last:border-b-0">
            <span className={cn(bar, 'h-3 w-40')} />
            <span className={cn(bar, 'h-3 w-28')} />
            <span className={cn(bar, 'h-3 w-16')} />
            <span className={cn(bar, 'hidden h-3 w-32 md:block')} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Steps({ steps, at }: { steps: string[]; at: number }) {
  return (
    // The live region wraps the list, so the list keeps its list role.
    <div role="status" aria-live="polite">
      <ol className="flex flex-col gap-2 text-[13px]">
        {steps.map((step, index) => (
          <li
            key={step}
            // Steps still to come stay readable: the reference's 60% grey fails contrast.
            className={cn('flex items-center gap-2', index > at && 'text-muted-foreground')}
          >
            {index < at ? (
              <CheckIcon aria-hidden className="text-success size-3.5 shrink-0" />
            ) : index === at ? (
              <Spinner className="size-3.5 shrink-0" />
            ) : (
              <span className="size-3.5 shrink-0" />
            )}
            <span className={cn(index === at && 'ai-shimmer')}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ProgressCard({
  title,
  steps,
  at,
  done,
  detail,
}: {
  title: string
  steps: string[]
  at: number
  done?: string | undefined
  detail?: string | undefined
}) {
  return (
    <div className="bg-background relative flex w-full max-w-xs flex-col gap-3 rounded-xl border p-4 shadow-lg">
      {done ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center" role="status">
          <CircleCheckIcon aria-hidden className="text-success size-9" />
          <p className="text-sm font-medium">{done}</p>
          {detail ? <p className="text-muted-foreground text-xs">{detail}</p> : null}
        </div>
      ) : (
        <>
          <p className="text-[13px] font-medium">{title}</p>
          <Steps steps={steps} at={at} />
        </>
      )}
    </div>
  )
}

function summaryOf(schema: PricingSchema): string {
  const n = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`
  return [
    n(schema.features.length, 'feature'),
    n(schema.plans.length, 'plan'),
    schema.creditGrants.length ? n(schema.creditGrants.length, 'credit grant') : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ---- the screen ---------------------------------------------------------- */

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
  createStep = null,
  created = false,
  onCancel,
}: PlanAiSetupViewProps) {
  usePublishDetailTrail([{ label: 'Plans', onClick: onCancel }, { label: 'Create with AI' }])
  const [template, setTemplate] = useState<Template | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  // The draft card walks its steps while the parser works, holding before the
  // last; the answer arriving shows "Checking it can be created" for a beat.
  const [draftAt, setDraftAt] = useState(0)
  const [checking, setChecking] = useState(false)
  const wasParsing = useRef(false)
  useEffect(() => {
    if (!isParsing) return
    wasParsing.current = true
    setDraftAt(0)
    const timer = setInterval(() => setDraftAt((at) => Math.min(at + 1, 2)), STEP_MS)
    return () => clearInterval(timer)
  }, [isParsing])
  useEffect(() => {
    if (isParsing || !wasParsing.current) return
    wasParsing.current = false
    if (!schema) return
    setDraftAt(3)
    setChecking(true)
    const timer = setTimeout(() => setChecking(false), STEP_MS)
    return () => clearTimeout(timer)
  }, [isParsing, schema])

  const problems = schema ? pricingSchemaProblems(schema) : []
  const drafting = isParsing || checking
  const reviewing = drafting || schema !== null || parseError !== null
  const creating = (isApplying || created) && schema !== null
  const canCreate = schema !== null && !drafting && !isApplying && problems.length === 0

  const send = () => {
    const text = description.trim() || DEFAULT_PROMPT
    if (!description.trim()) onDescriptionChange(DEFAULT_PROMPT)
    if (template && text === template.prompt.trim()) onParse(text, template.id)
    else onParse(text)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line; an IME's Enter commits a word.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    send()
  }

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground -ml-2 h-8 w-fit"
      onClick={onCancel}
    >
      <ArrowLeftIcon aria-hidden />
      Plans
    </Button>
  )

  if (!reviewing) {
    return (
      <TooltipProvider>
        <div className="ai-ground relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-6 2xl:px-14">
          {back}
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 py-10">
            <div className="flex flex-col gap-1.5 text-center">
              <h1 className="text-2xl font-medium tracking-tight">Set up your pricing</h1>
              <p className="text-muted-foreground text-sm">
                Describe a pricing model. Start from a template.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <Frame spacing="sm">
                <FramePanel fit className="p-0">
                  <InputGroup className="rounded-(--frame-panel-radius) border-0 bg-transparent">
                    <InputGroupTextarea
                      ref={field}
                      value={description}
                      onChange={(event) => {
                        onDescriptionChange(event.target.value)
                        if (template && event.target.value !== template.prompt) setTemplate(null)
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`${DEFAULT_PROMPT}…`}
                      aria-label="Describe your pricing"
                      className="placeholder:text-muted-foreground field-sizing-content max-h-60 min-h-24"
                    />
                    <InputGroupAddon align="block-end" className="gap-1">
                      {template ? (
                        <Badge variant="outline" className="h-6 gap-1.5 px-2">
                          <img
                            src={AI_TEMPLATE_LOGOS[template.id]}
                            alt=""
                            className="size-3 object-contain dark:brightness-0 dark:invert"
                          />
                          {template.label} template
                          <button
                            type="button"
                            aria-label="Clear template"
                            className="-mr-0.5 opacity-60 hover:opacity-100"
                            onClick={() => {
                              setTemplate(null)
                              onDescriptionChange('')
                              field.current?.focus()
                            }}
                          >
                            <XIcon aria-hidden className="size-3" />
                          </button>
                        </Badge>
                      ) : null}
                      <div className="ms-auto flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <InputGroupButton
                                type="submit"
                                size="icon-sm"
                                variant="default"
                                aria-label="Generate pricing"
                                className="rounded-full"
                              />
                            }
                          >
                            <ArrowUpIcon aria-hidden />
                          </TooltipTrigger>
                          <TooltipContent className="flex items-center gap-1.5">
                            Generate
                            <Kbd>Enter</Kbd>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                </FramePanel>
                <FrameFooter className="text-muted-foreground flex w-full flex-row items-center justify-between gap-3 text-xs">
                  <span>Paste a pricing page, or describe it in your own words.</span>
                  <span className="hidden items-center gap-1 sm:flex">
                    <Kbd>Shift</Kbd>
                    <Kbd>Enter</Kbd>
                    for a new line
                  </span>
                </FrameFooter>
              </Frame>
            </form>

            <div className="flex flex-col gap-3">
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="bg-border h-px flex-1" />
                Start from a template
                <span className="bg-border h-px flex-1" />
              </div>
              <div
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5"
                role="radiogroup"
                aria-label="Templates"
              >
                {TEMPLATES.map((item) => {
                  const picked = template?.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      onClick={() => {
                        setTemplate(picked ? null : item)
                        onDescriptionChange(picked ? '' : item.prompt)
                      }}
                      className={cn(
                        'bg-background hover:bg-muted/40 flex flex-col items-start gap-3 rounded-lg border p-3.5 text-left transition-colors',
                        picked && 'border-primary ring-primary/15 ring-2',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <img
                          src={AI_TEMPLATE_LOGOS[item.id]}
                          alt=""
                          className="size-4 object-contain dark:brightness-0 dark:invert"
                        />
                        <span className="text-[13px] font-medium">{item.label}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">{item.kind}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-10 py-3 2xl:px-14">
        <div className="flex items-center gap-3">
          {back}
          <span aria-hidden className="bg-border h-4 w-px" />
          <h1 className="text-sm font-medium">Review your pricing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8" disabled={isApplying} onClick={onDiscard}>
            Start over
          </Button>
          <Button className="h-8" disabled={!canCreate} onClick={onApply}>
            {isApplying ? 'Creating…' : 'Create all of this'}
          </Button>
        </div>
      </header>

      <section className="ai-canvas relative flex min-h-[60vh] flex-1 flex-col overflow-y-auto px-10 py-6 2xl:px-14">
        {parseError && !drafting ? (
          <div className="mx-auto w-full max-w-xl">
            <AppFailure
              title="That could not be read"
              detail={parseError}
              onRetry={() => onParse(description)}
            />
          </div>
        ) : schema && !drafting ? (
          <div className="flex flex-col gap-6">
            {problems.length > 0 ? (
              <Alert variant="destructive" className="mx-auto w-full max-w-6xl">
                <AlertTitle>These have to be fixed first</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                  Start over, add the missing detail to the description and generate it again.
                </AlertDescription>
              </Alert>
            ) : null}
            {applyError ? (
              <div className="mx-auto w-full max-w-6xl">
                <AppFailure
                  title="Some of that could not be created"
                  detail={applyError}
                  onRetry={onApply}
                />
              </div>
            ) : null}
            <Draft schema={schema} />
          </div>
        ) : (
          <>
            <div className="pointer-events-none opacity-70 blur-[2px] select-none">
              <DraftSkeleton count={3} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <ProgressCard title="Drafting your pricing" steps={DRAFT_STEPS} at={draftAt} />
            </div>
          </>
        )}
      </section>

      {creating && schema ? (
        <div className="bg-background/50 animate-in fade-in absolute inset-0 z-20 flex items-center justify-center p-4 backdrop-blur-md duration-200">
          <div aria-hidden className="ai-sweep pointer-events-none absolute inset-0" />
          <ProgressCard
            title="Creating your pricing"
            steps={CREATE_STEPS}
            at={created ? CREATE_STEPS.length : CREATE_STEP_INDEX[createStep ?? 'features']}
            done={created ? 'Your pricing has been created' : undefined}
            detail={summaryOf(schema)}
          />
        </div>
      ) : null}
    </div>
  )
}
