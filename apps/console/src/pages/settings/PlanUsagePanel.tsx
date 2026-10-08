import type { TenantFeatureUsage, TenantPlan } from '@fp/domain'
import { isOverLimit } from '@fp/domain'
import { useTenantBillingUsage } from '@fp/query'
import { EmptyState, LoadingRows } from '@fp/ui/compositions'
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { RouteOffIcon } from 'lucide-react'
import { Fact, Panel, PanelError, formatDate, toFailure, SettingsBlock } from './panelKit'

/**
 * What Flexprice is billing *this* tenant — its own plan, and its own usage
 * against it.
 *
 * ## It renders unavailable today, and says exactly why
 *
 * `useTenantBillingUsage` resolves `null`, always. `@flexprice/sdk@2.1.30`
 * calls `GET /v1/tenant/billing` — singular — and the deployed route is
 * `GET /v1/tenants/billing`. One missing `s` in the OpenAPI path. Verified
 * live: the SDK's path answers `404 text/plain "404 page not found"` while the
 * plural path returns 200 with exactly the body this panel wants. `@fp/query`
 * turns that one 404 into `null` rather than an error, precisely so this panel
 * can say "the route is wrong" instead of showing a red box nobody can act on.
 *
 * So the empty state here names the typo. It does **not** say "no data" — that
 * would be false, the data exists and is one character away — and it does not
 * say "coming soon", because the fix is a one-line change to somebody's
 * OpenAPI document, not a roadmap item.
 *
 * ## Two nulls that would read as zeros
 *
 * `total_limit: null` means **unlimited**, not nought. A `?? 0` renders
 * "0 of 0" for a customer who has no limit at all, which is the most alarming
 * possible way to display the most generous possible plan. `isUnlimited`
 * carries it, and the cell says "Unlimited".
 *
 * `usage.period` also came back `null` on a live tenant with an active monthly
 * subscription, so the period line is omitted when it is absent rather than
 * printing an epoch date.
 */
export function PlanUsagePanel() {
  const usage = useTenantBillingUsage()
  const failure = toFailure(usage.error, 'your plan and usage')

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void usage.refetch()} />
      </Panel>
    )
  }

  if (usage.isPending) {
    return (
      <Panel>
        <LoadingRows rows={5} />
      </Panel>
    )
  }

  if (!usage.data) return <BillingRouteUnavailable />

  const { plans, features, periodStart, periodEnd } = usage.data

  // `usage.period` comes back null on live tenants with an active subscription,
  // so the period is mentioned only when there is one to mention.
  const period =
    periodStart || periodEnd
      ? `Current period ${formatDate(periodStart)} to ${formatDate(periodEnd)}`
      : null

  return (
    <Panel>
      <SettingsBlock label="Plan">
        {period ? <p className="text-muted-foreground text-xs">{period}</p> : null}
        {plans.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subscription is attached to this organisation.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {plans.map((plan) => (
              <PlanRow key={plan.subscriptionId} plan={plan} />
            ))}
          </div>
        )}
      </SettingsBlock>

      <SettingsBlock label="Usage">

        {features.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No metered entitlements are attached to this plan.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entitlement</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Resets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature) => (
                <UsageRow key={feature.featureId} feature={feature} />
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsBlock>
    </Panel>
  )
}

function PlanRow({ plan }: { plan: TenantPlan }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-4">
      <Fact label="Plan">
        <span className="font-medium">{plan.planName || plan.planId || '—'}</span>
      </Fact>
      <Fact label="Status">
        <span className="capitalize">{plan.status || '—'}</span>
      </Fact>
      <Fact label="Billing">
        {plan.billingPeriod ? (
          <span className="capitalize">
            {plan.billingPeriod.toLowerCase()}
            {plan.currency ? ` · ${plan.currency.toUpperCase()}` : ''}
          </span>
        ) : (
          '—'
        )}
      </Fact>
      <Fact label={plan.cancelAtPeriodEnd ? 'Ends' : 'Renews'}>
        {formatDate(plan.currentPeriodEnd)}
      </Fact>
    </dl>
  )
}

function UsageRow({ feature }: { feature: TenantFeatureUsage }) {
  const over = isOverLimit(feature)

  return (
    <TableRow>
      <TableCell className="font-medium">{feature.featureName || feature.featureId}</TableCell>
      <TableCell>{feature.currentUsage || '0'}</TableCell>
      <TableCell>
        {/*
         * `null` is unlimited, and it has to say so. `?? 0` here would print
         * "0" as the limit for the one customer who has none.
         */}
        {feature.isUnlimited || feature.limit === null ? (
          <span className="text-muted-foreground">Unlimited</span>
        ) : (
          <span className="flex items-center gap-2">
            {feature.limit}
            {over ? <Badge variant="destructive-light">Over</Badge> : null}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(feature.nextUsageResetAt)}
      </TableCell>
    </TableRow>
  )
}

/**
 * The state this panel is actually in today.
 *
 * Written as a bug report the reader can hand to whoever owns the API, because
 * that is the only action that changes anything here.
 */
function BillingRouteUnavailable() {
  return (
    <Panel>
      <EmptyState
        size="page"
        icon={<RouteOffIcon aria-hidden />}
        title="Plan and usage cannot be loaded"
        description={
          'This is a wrong route, not missing data. The generated client requests ' +
          'GET /v1/tenant/billing — singular — and the deployed route is ' +
          'GET /v1/tenants/billing. The singular path answers 404; the plural one returns ' +
          'this organisation’s plan and usage. It is a one-character fix in the OpenAPI ' +
          'document, after which this panel works with no change here.'
        }
      />
    </Panel>
  )
}
