import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  stripSearchParams,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useState as useReactState } from 'react'
import { LoadingRows } from '@fp/ui/compositions'
import { ConsoleShell } from './shell/ConsoleShell'
import type { InvoiceQuery } from '@fp/domain'
const InvoiceListPage = lazy(() =>
  import('@/pages/invoices/InvoiceListPage').then((m) => ({ default: m.InvoiceListPage })),
)
import { DEFAULT_INVOICE_QUERY } from '@fp/domain'
import { parseInvoiceSearch } from './searchParams'
import { useState } from 'react'
import type { PriceOverride } from '@fp/domain'
const SubscriptionCreatePage = lazy(() =>
  import('@/pages/subscriptions/SubscriptionCreatePage').then((m) => ({
    default: m.SubscriptionCreatePage,
  })),
)
import { type SubscriptionStepId, furthestOf, parseStep, toStepSearch } from './subscriptionSteps'
import { DEFAULT_FEATURE_QUERY, type FeatureQuery } from '@fp/domain'
/**
 * Routes are split, from the first one.
 *
 * The bundle was 1.25 MB with a single screen in it. Retrofitting splitting
 * after a dozen screens means auditing a dozen import graphs; doing it now
 * costs one `lazy` per route.
 */
const FeatureListPage = lazy(() =>
  import('@/pages/features/FeatureListPage').then((m) => ({ default: m.FeatureListPage })),
)
const FeatureCreatePage = lazy(() =>
  import('@/pages/features/FeatureCreatePage').then((m) => ({ default: m.FeatureCreatePage })),
)
import { parseFeatureSearch } from './featureSearch'

const SANDBOX = { id: 'env_dev', name: 'Sandbox', kind: 'sandbox' } as const
const PRODUCTION = { id: 'env_prod', name: 'Production', kind: 'production' } as const

/**
 * The shell wraps every route.
 *
 * Environment state is local until the environment endpoints are annotated —
 * `environment.go` is 1 of 5, so there is no documented way to list them yet.
 * The shape is already right, so wiring it is a change in one place.
 */
function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useRouterState({ select: (state) => state.location })
  const [environmentId, setEnvironmentId] = useReactState<string>(SANDBOX.id)

  const environments = [SANDBOX, PRODUCTION]
  const environment = environments.find((e) => e.id === environmentId) ?? SANDBOX

  return (
    <ConsoleShell
      pathname={pathname}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
      environment={environment}
      environments={environments}
      onEnvironmentChange={setEnvironmentId}
      user={{ name: 'Signed in', email: 'you@flexprice.io' }}
    >
      {/* A route's chunk is fetched on navigation; this is what shows meanwhile. */}
      <Suspense fallback={<div className="p-6"><LoadingRows /></div>}>
        <Outlet />
      </Suspense>
    </ConsoleShell>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // `/invoices` declares required search params, so TanStack demands a
    // `search` here. Empty is correct: `validateSearch` is total and parses
    // `{}` into the defaults — asserted in `searchParams.test.ts`. Passing the
    // defaults explicitly instead would spell every one of them into the URL
    // on first load.
    throw redirect({ to: '/invoices', search: {} as never })
  },
})

/**
 * The invoice list route.
 *
 * `validateSearch` is what makes the URL the source of truth: it turns whatever
 * is in the address bar into a valid `InvoiceQuery`, so the page receives a
 * domain object and never parses a string. It is total by construction — a
 * hand-edited URL degrades to defaults rather than throwing.
 */
const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices',
  validateSearch: (search: Record<string, unknown>): InvoiceQuery =>
    parseInvoiceSearch(search),
  /**
   * Keep defaults out of the address bar.
   *
   * `validateSearch` returns a *complete* query — which is what makes the page
   * type-safe — but TanStack then writes all of it into the URL, so `/invoices`
   * became `?page=1&pageSize=25&sortBy=issuedAt&…&statuses=%5B%5D`. Unreadable,
   * un-shareable, and it made `/invoices` one of many spellings of itself.
   *
   * The codec's own tests could not catch this: they asserted the serializer
   * omits defaults, and the router was not calling the serializer.
   */
  search: { middlewares: [stripSearchParams(DEFAULT_INVOICE_QUERY)] },
  component: InvoicesRouteComponent,
})

function InvoicesRouteComponent() {
  const query = useSearch({ from: invoicesRoute.id })
  const navigate = useNavigate()

  return (
    <InvoiceListPage
      query={query}
      onQueryChange={(next) =>
        void navigate({
          to: '/invoices',
          search: next,
          // Paging and sorting are navigation, not history. Without this, Back
          // walks the user through every page they clicked instead of leaving
          // the list.
          replace: true,
        })
      }
    />
  )
}

/**
 * Subscription creation.
 *
 * The step lives in the URL — `/subscriptions/new?step=prices` — so a
 * half-finished subscription is linkable, resumable, and navigable with the
 * back button. See `docs/architecture.md`: the stepper owns presentation, the
 * route owns workflow state.
 */
const subscriptionCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscriptions/new',
  validateSearch: (search: Record<string, unknown>) => ({ step: parseStep(search['step']) }),
  component: SubscriptionCreateRouteComponent,
})

function SubscriptionCreateRouteComponent() {
  const { step } = subscriptionCreateRoute.useSearch()
  const navigate = useNavigate()

  // Progress and the collected override are local only because the remaining
  // steps do not exist. Once they do, this becomes the wizard's own draft —
  // the step itself never needs to change.
  const [furthestReached, setFurthestReached] = useState<SubscriptionStepId>(step)
  const [override, setOverride] = useState<PriceOverride>()

  const goToStep = (next: SubscriptionStepId) => {
    // Progress only advances, so stepping back does not re-lock what was reached.
    setFurthestReached((furthest) => furthestOf(furthest, next))
    void navigate({ to: '/subscriptions/new', search: toStepSearch(next) as never })
  }

  return (
    <SubscriptionCreatePage
      step={step}
      furthestReached={furthestReached}
      onStepChange={goToStep}
      priceId="price_01"
      override={override}
      onOverrideChange={(value) => {
        setOverride(value)
        goToStep('entitlements')
      }}
      onCancel={() => void navigate({ to: '/invoices', search: {} as never })}
    />
  )
}

/**
 * Features: list and create.
 *
 * The first migrated V1 surface. The query lives in search params, so a
 * filtered list is a link — which V1's version cannot produce.
 */
const featuresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features',
  validateSearch: (search: Record<string, unknown>): FeatureQuery => parseFeatureSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_FEATURE_QUERY)] },
  component: FeaturesRouteComponent,
})

function FeaturesRouteComponent() {
  const query = useSearch({ from: featuresRoute.id })
  const navigate = useNavigate()

  return (
    <FeatureListPage
      query={query}
      onQueryChange={(next) =>
        void navigate({ to: '/features', search: next, replace: true })
      }
      onCreate={() => void navigate({ to: '/features/new' })}
      onOpenFeature={(feature) =>
        void navigate({ to: '/features', search: { ...query, search: feature.name, page: 1 } })
      }
    />
  )
}

const featureCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/new',
  component: FeatureCreateRouteComponent,
})

function FeatureCreateRouteComponent() {
  const navigate = useNavigate()
  const backToList = () => void navigate({ to: '/features', search: {} as never })

  return <FeatureCreatePage onCreated={backToList} onCancel={backToList} />
}

export const routeTree = rootRoute.addChildren([
  featuresRoute,
  featureCreateRoute,
  indexRoute,
  invoicesRoute,
  subscriptionCreateRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
