import type { ReactNode } from 'react'
import {
  CheckIcon,
  LayersIcon,
  SparklesIcon,
  SquareStackIcon,
  GaugeIcon,
  ReceiptTextIcon,
} from '@ui/icons'
import {
  PLAN_KIND_LABEL,
  type PricingSchema,
  pricingSchemaProblems,
  pricingSchemaTotals,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Textarea } from '@ui/components/primitives/textarea'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Section } from '@ui/compositions/layout/Section'
import { FormCard } from '@ui/compositions/forms/FormCard'
import { AppFailure } from '@ui/compositions/feedback/AppFailure'
import { provenance } from '@ui/provenance'
import { EmDash, Pill, Tag } from '../../shared/cells'

/**
 * Describe a pricing page; get a catalogue.
 *
 * Two screens in one, because they are two halves of one decision. First a
 * description goes to the parser. What comes back is *not* applied: it is laid
 * out as the features, plans, prices, entitlements and grants it would create,
 * and only a second, explicit action writes any of it.
 *
 * That split is the whole design. A model reading a pricing page will
 * sometimes invent a tier or miss a cap, and the cost of finding out
 * afterwards is a catalogue someone has to unpick by hand. Everything created
 * is tagged `created_with_ai` for exactly that reason.
 */
export const PlanAiSetupViewProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/cells', 'compositions/form-card'],
  note: 'Describe-and-review screen for AI pricing setup; parses, then shows what would be created.',
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

const EXAMPLE = `Three plans. Starter is $29/month with 10,000 API calls included, then $0.01 per extra call. Pro is $99/month with 100,000 calls and 5 seats. Enterprise is custom, billed annually, with unlimited calls.`

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-medium">
          <SparklesIcon aria-hidden className="size-5" />
          Create with AI
        </h1>
        <p className="text-muted-foreground text-sm">
          Describe how you charge and this drafts the features, plans and prices. Nothing is created
          until you have read it.
        </p>
      </div>

      <FormCard title="Your pricing" status="required">
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          <Textarea
            aria-label="Describe your pricing"
            rows={6}
            placeholder={EXAMPLE}
            value={description}
            disabled={isParsing || isApplying}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Paste the text of a pricing page, or write it out. Be specific about what is included
              and what is charged per unit.
            </p>
            <Button
              onClick={onParse}
              disabled={description.trim().length === 0 || isParsing || isApplying}
            >
              <SparklesIcon aria-hidden />
              {isParsing ? 'Reading…' : schema ? 'Read it again' : 'Read my pricing'}
            </Button>
          </div>
        </div>
      </FormCard>

      {parseError ? (
        <AppFailure title="That could not be read" detail={parseError} onRetry={onParse} />
      ) : null}

      {isParsing ? <ParsingSkeleton /> : null}

      {schema && !isParsing ? (
        <>
          <Section
            title="What this will create"
            {...(summary ? { description: summary } : {})}
            flush
          >
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
          </Section>

          {problems.length > 0 ? (
            <Section title="These have to be fixed first">
              <ul className="text-destructive flex list-disc flex-col gap-1.5 pl-5 text-sm">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-[13px]">
                Add the missing detail to the description above and read it again.
              </p>
            </Section>
          ) : null}

          {applyError ? (
            <AppFailure
              title="Some of that could not be created"
              detail={applyError}
              onRetry={onApply}
            />
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {isApplying && applyStep ? (
                <span className="text-muted-foreground text-sm">{applyStep}…</span>
              ) : null}
              <Button variant="outline" onClick={onDiscard} disabled={isApplying}>
                Start over
              </Button>
              <Button onClick={onApply} disabled={!canApply}>
                <SquareStackIcon aria-hidden />
                {isApplying ? 'Creating…' : 'Create all of this'}
              </Button>
            </div>
          </div>
        </>
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

function ParsingSkeleton() {
  return (
    <Section title="Reading your pricing" flush>
      <div className="flex flex-col gap-3 px-6 py-5">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    </Section>
  )
}
