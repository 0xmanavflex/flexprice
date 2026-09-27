import {
  createRootRoute,
  createRoute,
  createRouter,
  stripSearchParams,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { AppFailure, LoadingRows } from '@fp/ui/compositions'
import { ConsoleShell } from './shell/ConsoleShell'
import { useEnvironments } from './shell/useEnvironments'
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
import { DEFAULT_PLAN_QUERY, type PlanQuery } from '@fp/domain'
const PlanListPage = lazy(() =>
  import('@/pages/plans/PlanListPage').then((m) => ({ default: m.PlanListPage })),
)
import { parsePlanSearch } from './planSearch'
import { DEFAULT_ADDON_QUERY, type AddonQuery } from '@fp/domain'
const AddonListPage = lazy(() =>
  import('@/pages/addons/AddonListPage').then((m) => ({ default: m.AddonListPage })),
)
import { parseAddonSearch } from './addonSearch'
import { PLACEHOLDER_ROUTES } from './placeholderRoutes'
const PlaceholderPage = lazy(() =>
  import('@/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })),
)

/**
 * The shell wraps every route.
 *
 * The environment list lives in `useEnvironments`, which is also the one place
 * that records why it is not yet a request — see the note there.
 */
function RootLayout() {
  const navigate = useNavigate()
  const { pathname } = useRouterState({ select: (state) => state.location })
  const environments = useEnvironments()

  return (
    <ConsoleShell
      pathname={pathname}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
      environment={environments.current}
      environments={environments.environments}
      onEnvironmentChange={environments.select}
      onEnvironmentCreate={environments.create}
      canCreateProduction={environments.canCreateProduction}
      // Placeholder until the session lands — `auth.go` is 0 of 2 annotated,
      // so there is no documented way to ask who is signed in yet.
      user={{ name: 'Signed in', email: 'you@flexprice.io', organization: 'Flexprice' }}
    >
      {/* A route's chunk is fetched on navigation; this is what shows meanwhile. */}
      <Suspense fallback={<div className="p-6"><LoadingRows /></div>}>
        <Outlet />
      </Suspense>
    </ConsoleShell>
  )
}

const rootRoute = createRootRoute({
  component: RootLayout,
  /**
   * Without this a thrown route — including a rejected lazy import — renders
   * nothing at all, and a crash is indistinguishable from an empty list.
   */
  /**
   * A mistyped or retired URL. Distinct from `errorComponent`, which is for a
   * page that exists and broke — the two need different words and different
   * ways out.
   */
  notFoundComponent: () => (
    <AppFailure
      title="There is no page at this address"
      detail="The link may be out of date, or the address mistyped. Everything in the sidebar still works."
    />
  ),
  errorComponent: ({ error, reset }) => (
    <AppFailure
      title="This page could not be loaded"
      detail="The rest of the console still works. Try again, or pick another page."
      onRetry={reset}
      {...(import.meta.env.DEV && error instanceof Error ? { technical: error.stack ?? error.message } : {})}
    />
  ),
})

/**
 * Every destination in the sidebar resolves to something.
 *
 * Before this, twenty of twenty-four navigated to a bare "Not Found" — which
 * is what a broken link looks like, so the shell appeared broken rather than
 * unfinished. A placeholder says which screen this is, what it will do, and
 * where the working version is today.
 *
 * The rows come from `placeholderRoutes.ts`, and a row is deleted when its
 * real page lands. `/` is among them: Home is a destination, not a redirect to
 * whichever list happened to be built first.
 */
const placeholderRoutes = PLACEHOLDER_ROUTES.map((entry) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: entry.path,
    component: () => (
      <PlaceholderPage
        title={entry.title}
        description={entry.description}
        emptyTitle={entry.emptyTitle}
        emptyDescription={entry.emptyDescription}
        cta={entry.cta}
        {...('legacy' in entry ? { legacyPath: entry.legacy } : {})}
      />
    ),
  }),
)

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
      onCancel={() => void navigate({ to: '/subscriptions' })}
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

/**
 * Plans: the list. Same URL-as-query contract as features and invoices — a
 * filtered, sorted, paged view is a link. The `/plans/new` editor is a later
 * surface; for now the create action hands off to the legacy dashboard.
 */
const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans',
  validateSearch: (search: Record<string, unknown>): PlanQuery => parsePlanSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_PLAN_QUERY)] },
  component: PlansRouteComponent,
})

function PlansRouteComponent() {
  const query = useSearch({ from: plansRoute.id })
  const navigate = useNavigate()

  return (
    <PlanListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/plans', search: next, replace: true })}
      // The plan editor is not built yet; opening or creating narrows the list
      // to that plan for now, so the action does something honest rather than
      // navigating to a page that does not exist.
      onCreate={() => void navigate({ to: '/plans', search: { ...query, page: 1 } })}
      onOpenPlan={(plan) =>
        void navigate({ to: '/plans', search: { ...query, search: plan.name, page: 1 } })
      }
    />
  )
}

/**
 * Add-ons: the list. The same URL-as-query contract; the editor it shares with
 * plans is a later surface, so create/open narrow the list for now.
 */
const addonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/addons',
  validateSearch: (search: Record<string, unknown>): AddonQuery => parseAddonSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_ADDON_QUERY)] },
  component: AddonsRouteComponent,
})

function AddonsRouteComponent() {
  const query = useSearch({ from: addonsRoute.id })
  const navigate = useNavigate()

  return (
    <AddonListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/addons', search: next, replace: true })}
      onCreate={() => void navigate({ to: '/addons', search: { ...query, page: 1 } })}
      onOpenAddon={(addon) =>
        void navigate({ to: '/addons', search: { ...query, search: addon.name, page: 1 } })
      }
    />
  )
}

export const routeTree = rootRoute.addChildren([
  featuresRoute,
  featureCreateRoute,
  plansRoute,
  addonsRoute,
  invoicesRoute,
  subscriptionCreateRoute,
  ...placeholderRoutes,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
