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
const PlanDetailPage = lazy(() =>
  import('@/pages/plans/PlanDetailPage').then((m) => ({ default: m.PlanDetailPage })),
)
const PlanChargesPage = lazy(() =>
  import('@/pages/plans/PlanChargesPage').then((m) => ({ default: m.PlanChargesPage })),
)
import { parsePlanTab, type PlanTab } from '@/pages/plans/PlanDetailPage'
import { parsePlanSearch } from './planSearch'
import { DEFAULT_ADDON_QUERY, type AddonQuery } from '@fp/domain'
const AddonListPage = lazy(() =>
  import('@/pages/addons/AddonListPage').then((m) => ({ default: m.AddonListPage })),
)
import { parseAddonSearch } from './addonSearch'
import { DEFAULT_COUPON_QUERY, type CouponQuery } from '@fp/domain'
const CouponListPage = lazy(() =>
  import('@/pages/coupons/CouponListPage').then((m) => ({ default: m.CouponListPage })),
)
const CouponDetailPage = lazy(() =>
  import('@/pages/coupons/CouponDetailPage').then((m) => ({ default: m.CouponDetailPage })),
)
import { parseCouponSearch } from './couponSearch'
import { DEFAULT_PRICE_UNIT_QUERY, type PriceUnitQuery } from '@fp/domain'
const PriceUnitListPage = lazy(() =>
  import('@/pages/price-units/PriceUnitListPage').then((m) => ({ default: m.PriceUnitListPage })),
)
import { parsePriceUnitSearch } from './priceUnitSearch'
import { DEFAULT_GROUP_QUERY, type GroupQuery } from '@fp/domain'
const GroupListPage = lazy(() =>
  import('@/pages/groups/GroupListPage').then((m) => ({ default: m.GroupListPage })),
)
import { parseGroupSearch } from './groupSearch'
import { DEFAULT_COST_SHEET_QUERY, type CostSheetQuery } from '@fp/domain'
const CostSheetListPage = lazy(() =>
  import('@/pages/cost-sheets/CostSheetListPage').then((m) => ({ default: m.CostSheetListPage })),
)
import { parseCostSheetSearch } from './costSheetSearch'
import { PLACEHOLDER_ROUTES } from './placeholderRoutes'
const PlaceholderPage = lazy(() =>
  import('@/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })),
)
const HomePage = lazy(() => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })))

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
 * Plans: the list, plus a create/edit drawer the page owns.
 *
 * Same URL-as-query contract as features and invoices — a filtered, sorted,
 * paged view is a link. Creating or editing a plan's details happens in a drawer
 * over the list (see `PlanListPage`); the charges editor is a later surface.
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
      onOpenPlan={(planId) =>
        void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
      }
    />
  )
}

/**
 * A plan's detail page and its charges builder.
 *
 * `/plans/$planId` is the tabbed hub; `?tab=` keeps the open tab in the URL, so a
 * plan's entitlements or credit grants are a link. `/plans/$planId/charges` is
 * the two-pane charges editor, a full route rather than a drawer because pricing
 * a plan is the work, not an aside to it.
 */
const planDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans/$planId',
  validateSearch: (search: Record<string, unknown>): { tab: PlanTab } => ({
    tab: parsePlanTab(search['tab']),
  }),
  // Overview is the default tab, so it stays out of the address bar; only a
  // non-default tab appears as `?tab=`.
  search: { middlewares: [stripSearchParams({ tab: 'overview' })] },
  component: PlanDetailRouteComponent,
})

function PlanDetailRouteComponent() {
  const { planId } = planDetailRoute.useParams()
  const { tab } = planDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <PlanDetailPage
      planId={planId}
      tab={tab}
      onTabChange={(next) =>
        void navigate({
          to: '/plans/$planId',
          params: { planId },
          search: { tab: next },
          replace: true,
        })
      }
      onOpenCharges={() =>
        void navigate({ to: '/plans/$planId/charges', params: { planId }, search: {} as never })
      }
      onArchived={() => void navigate({ to: '/plans', search: {} as never })}
      onDuplicated={(newId) =>
        void navigate({ to: '/plans/$planId', params: { planId: newId }, search: {} as never })
      }
    />
  )
}

const planChargesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans/$planId/charges',
  component: PlanChargesRouteComponent,
})

function PlanChargesRouteComponent() {
  const { planId } = planChargesRoute.useParams()
  const navigate = useNavigate()
  const toDetail = () =>
    void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })

  return <PlanChargesPage planId={planId} onDone={toDetail} onCancel={toDetail} />
}

/**
 * Add-ons: the list, plus a create/edit drawer the page owns.
 *
 * The list keeps the URL-as-query contract; the editor is local state, so the
 * route only has to hand the page its query. Creating or editing an add-on
 * happens in a drawer over the list — see `AddonListPage`.
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
    />
  )
}

/**
 * Coupons: the list, plus a read-only detail page with a rename drawer.
 *
 * The list keeps the URL-as-query contract; opening a coupon navigates to
 * `/coupons/$couponId`, which is where the discount, redemptions, window, and —
 * the V2 addition — where the coupon is applied all live. Editing is limited to
 * a rename (the discount is immutable), so it stays a drawer over the detail.
 */
const couponsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coupons',
  validateSearch: (search: Record<string, unknown>): CouponQuery => parseCouponSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_COUPON_QUERY)] },
  component: CouponsRouteComponent,
})

function CouponsRouteComponent() {
  const query = useSearch({ from: couponsRoute.id })
  const navigate = useNavigate()

  return (
    <CouponListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/coupons', search: next, replace: true })}
      onCreate={() => void navigate({ to: '/coupons', search: { ...query, page: 1 } })}
      onOpenCoupon={(coupon) =>
        void navigate({ to: '/coupons/$couponId', params: { couponId: coupon.id } })
      }
    />
  )
}

const couponDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coupons/$couponId',
  component: CouponDetailRouteComponent,
})

function CouponDetailRouteComponent() {
  const { couponId } = couponDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <CouponDetailPage
      couponId={couponId}
      onBack={() => void navigate({ to: '/coupons', search: {} as never })}
    />
  )
}

/**
 * Price units: the list, plus a create/edit drawer the page owns.
 *
 * The same shape as add-ons — URL-as-query list, editor in local state — because
 * V1 keeps price units to a list and a drawer with no detail page. The route
 * only has to hand the page its query; opening the editor happens over the list
 * (see `PriceUnitListPage`).
 */
const priceUnitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/price-units',
  validateSearch: (search: Record<string, unknown>): PriceUnitQuery => parsePriceUnitSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_PRICE_UNIT_QUERY)] },
  component: PriceUnitsRouteComponent,
})

function PriceUnitsRouteComponent() {
  const query = useSearch({ from: priceUnitsRoute.id })
  const navigate = useNavigate()

  return (
    <PriceUnitListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/price-units', search: next, replace: true })}
    />
  )
}

/**
 * Groups and cost sheets: the same URL-as-query contract as the other
 * catalogue lists. Each is read-only for now — the editor is a later surface,
 * the way coupons shipped a list before its editor — so the route only has to
 * hand the page its query.
 */
const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  validateSearch: (search: Record<string, unknown>): GroupQuery => parseGroupSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_GROUP_QUERY)] },
  component: GroupsRouteComponent,
})

function GroupsRouteComponent() {
  const query = useSearch({ from: groupsRoute.id })
  const navigate = useNavigate()

  return (
    <GroupListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/groups', search: next, replace: true })}
    />
  )
}

const costSheetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cost-sheets',
  validateSearch: (search: Record<string, unknown>): CostSheetQuery => parseCostSheetSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_COST_SHEET_QUERY)] },
  component: CostSheetsRouteComponent,
})

function CostSheetsRouteComponent() {
  const query = useSearch({ from: costSheetsRoute.id })
  const navigate = useNavigate()

  return (
    <CostSheetListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/cost-sheets', search: next, replace: true })}
    />
  )
}

/**
 * Home — the ReUI `dashboard-4` block, mounted as installed.
 *
 * The first destination in the sidebar, and the only one that is a dashboard
 * rather than a list. It carries no query state yet; the block renders its own
 * sample data until it is wired to real revenue and usage.
 */
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

export const routeTree = rootRoute.addChildren([
  homeRoute,
  featuresRoute,
  featureCreateRoute,
  plansRoute,
  // The charges route is registered before the detail route so `/plans/x/charges`
  // is matched by it, not swallowed as a `$planId` of "x/charges".
  planChargesRoute,
  planDetailRoute,
  addonsRoute,
  couponsRoute,
  couponDetailRoute,
  priceUnitsRoute,
  groupsRoute,
  costSheetsRoute,
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
