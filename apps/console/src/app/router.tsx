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
import { lazy, Suspense } from 'react'
import { AppFailure, LoadingRows } from '@fp/ui/compositions'
import { useCurrentUser } from '@fp/query'
import { ConsoleShell } from './shell/ConsoleShell'
import { hasSession, needsSignIn, useSession } from './session'
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
import { parseFeatureSearch } from './featureSearch'
import { DEFAULT_PLAN_QUERY, type PlanQuery } from '@fp/domain'
const PlanListPage = lazy(() =>
  import('@/pages/plans/PlanListPage').then((m) => ({ default: m.PlanListPage })),
)
const PlanDetailPage = lazy(() =>
  import('@/pages/plans/PlanDetailPage').then((m) => ({ default: m.PlanDetailPage })),
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
const CustomerListPage = lazy(() =>
  import('@/pages/customers/CustomerListPage').then((m) => ({ default: m.CustomerListPage })),
)
const CustomerDetailPage = lazy(() =>
  import('@/pages/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
)
import { parseCustomerTab } from '@/pages/customers/CustomerDetailPage'
import type { CustomerTab } from '@fp/ui/pages'
import { parseCustomerSearch } from './customerSearch'
import { DEFAULT_CUSTOMER_QUERY, type CustomerQuery } from '@fp/domain'
const SubscriptionListPage = lazy(() =>
  import('@/pages/subscriptions/SubscriptionListPage').then((m) => ({
    default: m.SubscriptionListPage,
  })),
)
import { parseSubscriptionSearch } from './subscriptionSearch'
import { DEFAULT_SUBSCRIPTION_QUERY, type SubscriptionQuery } from '@fp/domain'
const PaymentListPage = lazy(() =>
  import('@/pages/payments/PaymentListPage').then((m) => ({ default: m.PaymentListPage })),
)
import { parsePaymentSearch } from './paymentSearch'
const CreditNoteListPage = lazy(() =>
  import('@/pages/credit-notes/CreditNoteListPage').then((m) => ({
    default: m.CreditNoteListPage,
  })),
)
const WorkflowListPage = lazy(() =>
  import('@/pages/workflows/WorkflowListPage').then((m) => ({ default: m.WorkflowListPage })),
)
const IntegrationListPage = lazy(() =>
  import('@/pages/integrations/IntegrationListPage').then((m) => ({
    default: m.IntegrationListPage,
  })),
)
const PricingWidgetPage = lazy(() =>
  import('@/pages/pricing-widget/PricingWidgetPage').then((m) => ({
    default: m.PricingWidgetPage,
  })),
)
const ExportListPage = lazy(() =>
  import('@/pages/exports/ExportListPage').then((m) => ({ default: m.ExportListPage })),
)
import { parseDataExportSearch } from './dataExportSearch'
import { DEFAULT_DATA_EXPORT_QUERY, type DataExportQuery } from '@fp/domain'
const UsageSyncListPage = lazy(() =>
  import('@/pages/usage-syncs/UsageSyncListPage').then((m) => ({ default: m.UsageSyncListPage })),
)
import { parseUsageSyncSearch } from './usageSyncSearch'
import { DEFAULT_USAGE_SYNC_QUERY, type UsageSyncQuery } from '@fp/domain'
import { parseWorkflowSearch } from './workflowSearch'
import { DEFAULT_WORKFLOW_QUERY, type WorkflowQuery } from '@fp/domain'
import { parseCreditNoteSearch } from './creditNoteSearch'
import { type CreditNoteQuery, DEFAULT_CREDIT_NOTE_QUERY } from '@fp/domain'
import { DEFAULT_PAYMENT_QUERY, type PaymentQuery } from '@fp/domain'
const TaxListPage = lazy(() =>
  import('@/pages/taxes/TaxListPage').then((m) => ({ default: m.TaxListPage })),
)
import { parseTaxSearch } from './taxSearch'
import { DEFAULT_TAX_RATE_QUERY, type TaxRateQuery } from '@fp/domain'
const EventListPage = lazy(() =>
  import('@/pages/events/EventListPage').then((m) => ({ default: m.EventListPage })),
)
import { parseEventSearch } from './eventSearch'
import { DEFAULT_RAW_EVENT_QUERY, type RawEventQuery } from '@fp/domain'
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
import { DEFAULT_SETTINGS_QUERY, type SettingsQuery, parseSettingsSearch } from './settingsSearch'
const FeatureDetailPage = lazy(() =>
  import('@/pages/features/FeatureDetailPage').then((m) => ({ default: m.FeatureDetailPage })),
)
const AddonDetailPage = lazy(() =>
  import('@/pages/addons/AddonDetailPage').then((m) => ({ default: m.AddonDetailPage })),
)
const PriceUnitDetailPage = lazy(() =>
  import('@/pages/price-units/PriceUnitDetailPage').then((m) => ({
    default: m.PriceUnitDetailPage,
  })),
)
const GroupDetailPage = lazy(() =>
  import('@/pages/groups/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })),
)
const CostSheetDetailPage = lazy(() =>
  import('@/pages/cost-sheets/CostSheetDetailPage').then((m) => ({
    default: m.CostSheetDetailPage,
  })),
)
const PlaceholderPage = lazy(() =>
  import('@/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })),
)
const HomePage = lazy(() => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })))
const RevenuePage = lazy(() =>
  import('@/pages/revenue/RevenuePage').then((m) => ({ default: m.RevenuePage })),
)
/*
 * Not lazy, unlike every other page.
 *
 * It is the first thing a signed-out visitor sees, so putting it behind a
 * second network round trip buys a blank screen on the one route that has no
 * shell to render a spinner into.
 */
import { SignInPage } from '@/pages/auth/SignInPage'

/**
 * The shell wraps every route except the ones you can reach signed out.
 *
 * It is the component of a *pathless* layout route rather than of the root, so
 * that `/sign-in` can be a sibling of the whole console instead of a page
 * inside it. A sign-in screen with a sidebar behind it offers navigation to
 * someone who cannot navigate anywhere, which is both a lie and a flash of
 * someone else's data if the previous user's chunks are still cached.
 *
 * The environment list lives in `useEnvironments`, which is also the one place
 * that records why it is not yet a request — see the note there.
 */
function ShellLayout() {
  const navigate = useNavigate()
  const { pathname } = useRouterState({ select: (state) => state.location })
  const environments = useEnvironments()
  const { session, signOut } = useSession()
  /*
   * Who is signed in, when anyone is.
   *
   * The hook is a no-op without a token, so under mocks and behind an API key
   * this costs nothing and simply never resolves — which is why the fallbacks
   * below are the normal case there rather than an error state.
   */
  const currentUser = useCurrentUser(session?.token ?? null)
  const user = currentUser.data

  return (
    <ConsoleShell
      pathname={pathname}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
      environment={environments.current}
      environments={environments.environments}
      onEnvironmentChange={environments.select}
      onEnvironmentCreate={environments.create}
      canCreateProduction={environments.canCreateProduction}
      /*
       * The email is the name until `/users/me` says otherwise: it is the one
       * thing the person definitely recognises as theirs, and it is what they
       * just typed. Inventing a display name would be worse than showing none.
       */
      user={{
        name: user?.email ?? 'Signed in',
        email: user?.email ?? '',
        ...(user?.tenantName ? { organization: user.tenantName } : {}),
      }}
      onSignOut={() => {
        signOut()
        void navigate({ to: '/sign-in', search: {} as never })
      }}
    >
      {/* A route's chunk is fetched on navigation; this is what shows meanwhile. */}
      <Suspense
        fallback={
          <div className="p-6">
            <LoadingRows />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </ConsoleShell>
  )
}

/**
 * The root holds nothing but an outlet.
 *
 * Everything visible moved down to `shellRoute`, because the root is the only
 * place `/sign-in` can live without the shell around it.
 */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
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
      {...(import.meta.env.DEV && error instanceof Error
        ? { technical: error.stack ?? error.message }
        : {})}
    />
  ),
})

/**
 * The console proper: every route that requires a session.
 *
 * A pathless layout route — it contributes no path segment, only the shell and
 * the guard. Adding a route to the console means parenting it here; a route
 * parented to `rootRoute` is deliberately opting out of both.
 */
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_shell',
  /**
   * The guard, in `beforeLoad` rather than in a component.
   *
   * A guard that runs during render has already mounted the shell, so a
   * signed-out visitor sees the sidebar and a flash of empty lists before being
   * moved on. `beforeLoad` runs before any of that, and it can do so
   * synchronously because the session lives in `localStorage` — see
   * `session/guard.ts` for why mocks and an API key are exempt.
   *
   * The address being turned away is carried along, so a bookmarked
   * `/invoices?status=overdue` still resolves after signing in instead of
   * dumping the user on the home page.
   */
  beforeLoad: ({ location }) => {
    if (needsSignIn()) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
  },
  component: ShellLayout,
})

/**
 * Sign in — the one route outside the shell.
 *
 * Already signed in, it steps aside rather than offering a second sign-in: a
 * form that re-authenticates a user who is already authenticated is a way to
 * lose a working session to a typo. It steps aside only for a *real* session,
 * not for the bypasses — under mocks there is nobody signed in, and the page
 * still has to be reachable for the fixture-backed end-to-end suite.
 */
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: (search: Record<string, unknown>): { redirect: string | undefined } => ({
    redirect: typeof search['redirect'] === 'string' ? search['redirect'] : undefined,
  }),
  beforeLoad: () => {
    if (hasSession()) throw redirect({ to: '/' })
  },
  component: SignInRouteComponent,
})

function SignInRouteComponent() {
  const { redirect: target } = signInRoute.useSearch()
  return <SignInPage redirect={target} />
}

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
    getParentRoute: () => shellRoute,
    path: entry.path,
    component: () => (
      <PlaceholderPage
        title={entry.title}
        description={entry.description}
        emptyTitle={entry.emptyTitle}
        emptyDescription={entry.emptyDescription}
        cta={entry.cta}
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
  getParentRoute: () => shellRoute,
  path: '/invoices',
  validateSearch: (search: Record<string, unknown>): InvoiceQuery => parseInvoiceSearch(search),
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
  getParentRoute: () => shellRoute,
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
      onCancel={() => void navigate({ to: '/subscriptions', search: {} as never })}
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
  getParentRoute: () => shellRoute,
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
      onQueryChange={(next) => void navigate({ to: '/features', search: next, replace: true })}
      onOpenFeature={(feature) =>
        void navigate({ to: '/features/$featureId', params: { featureId: feature.id } })
      }
    />
  )
}

/**
 * `/features/new` is the shell's "New feature" entry. Creating is a dialog now,
 * so it renders the list with that dialog open; closing it drops back to the list.
 */
const featureCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/features/new',
  component: FeatureCreateRouteComponent,
})

function FeatureCreateRouteComponent() {
  const navigate = useNavigate()

  return (
    <FeatureListPage
      initialCreate
      query={DEFAULT_FEATURE_QUERY}
      onQueryChange={(next) => void navigate({ to: '/features', search: next })}
      onOpenFeature={(feature) =>
        void navigate({ to: '/features/$featureId', params: { featureId: feature.id } })
      }
    />
  )
}

/** The feature detail page. `/features/$featureId` — the id is a path param. */
const featureDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/features/$featureId',
  component: FeatureDetailRouteComponent,
})

function FeatureDetailRouteComponent() {
  const { featureId } = featureDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <FeatureDetailPage
      featureId={featureId}
      onNavigateToList={() => void navigate({ to: '/features', search: {} as never })}
    />
  )
}

/**
 * Plans: the list, plus a create/edit drawer the page owns.
 *
 * Same URL-as-query contract as features and invoices — a filtered, sorted,
 * paged view is a link. Creating or editing a plan's details happens in a drawer
 * over the list (see `PlanListPage`); the charges editor is a later surface.
 */
const plansRoute = createRoute({
  getParentRoute: () => shellRoute,
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
  getParentRoute: () => shellRoute,
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
      onArchived={() => void navigate({ to: '/plans', search: {} as never })}
      onNavigateToList={() => void navigate({ to: '/plans', search: {} as never })}
      onDuplicated={(newId) =>
        void navigate({ to: '/plans/$planId', params: { planId: newId }, search: {} as never })
      }
    />
  )
}

/**
 * Add-ons: the list, plus a create/edit drawer the page owns.
 *
 * The list keeps the URL-as-query contract; the editor is local state, so the
 * route only has to hand the page its query. Creating or editing an add-on
 * happens in a drawer over the list — see `AddonListPage`.
 */
const addonsRoute = createRoute({
  getParentRoute: () => shellRoute,
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
      onOpenAddon={(addon) =>
        void navigate({ to: '/addons/$addonId', params: { addonId: addon.id } })
      }
    />
  )
}

/** The add-on detail page. `/addons/$addonId` — view, and edit its details in place. */
const addonDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/addons/$addonId',
  component: AddonDetailRouteComponent,
})

function AddonDetailRouteComponent() {
  const { addonId } = addonDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <AddonDetailPage
      addonId={addonId}
      onNavigateToList={() => void navigate({ to: '/addons', search: {} as never })}
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
  getParentRoute: () => shellRoute,
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
      onOpenCoupon={(coupon) =>
        void navigate({ to: '/coupons/$couponId', params: { couponId: coupon.id } })
      }
    />
  )
}

const couponDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
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
  getParentRoute: () => shellRoute,
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
      onOpenPriceUnit={(priceUnit) =>
        void navigate({ to: '/price-units/$priceUnitId', params: { priceUnitId: priceUnit.id } })
      }
    />
  )
}

/** The price-unit detail page. `/price-units/$priceUnitId` — view, and edit in place. */
const priceUnitDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/price-units/$priceUnitId',
  component: PriceUnitDetailRouteComponent,
})

function PriceUnitDetailRouteComponent() {
  const { priceUnitId } = priceUnitDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <PriceUnitDetailPage
      priceUnitId={priceUnitId}
      onNavigateToList={() => void navigate({ to: '/price-units', search: {} as never })}
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
  getParentRoute: () => shellRoute,
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
      onOpenGroup={(group) =>
        void navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
      }
    />
  )
}

/** The group detail page. `/groups/$groupId` — a read-only view for now. */
const groupDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/groups/$groupId',
  component: GroupDetailRouteComponent,
})

function GroupDetailRouteComponent() {
  const { groupId } = groupDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <GroupDetailPage
      groupId={groupId}
      onNavigateToList={() => void navigate({ to: '/groups', search: {} as never })}
    />
  )
}

const costSheetsRoute = createRoute({
  getParentRoute: () => shellRoute,
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
      onOpenCostSheet={(costSheet) =>
        void navigate({ to: '/cost-sheets/$costSheetId', params: { costSheetId: costSheet.id } })
      }
    />
  )
}

/** The cost-sheet detail page. `/cost-sheets/$costSheetId` — a read-only view for now. */
const costSheetDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/cost-sheets/$costSheetId',
  component: CostSheetDetailRouteComponent,
})

function CostSheetDetailRouteComponent() {
  const { costSheetId } = costSheetDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <CostSheetDetailPage
      costSheetId={costSheetId}
      onNavigateToList={() => void navigate({ to: '/cost-sheets', search: {} as never })}
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
  getParentRoute: () => shellRoute,
  path: '/',
  component: HomePage,
})

/**
 * Revenue — a report page, not a list.
 *
 * The contract/usage mix, revenue by customer and margin by feature, from the
 * `RevenueDashboard` surface. It carries no query state yet; the surface renders
 * representative data until the revenue queries land.
 */
const revenueRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/revenue',
  component: RevenuePage,
})

/**
 * Billing lists — customers, subscriptions, payments and taxes. The same
 * URL-as-query contract as invoices and the catalogue lists: a filtered, sorted,
 * paged view is a link. Read-only lists for now, except subscriptions, whose
 * header opens the existing create wizard.
 */
const customersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers',
  validateSearch: (search: Record<string, unknown>): CustomerQuery => parseCustomerSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_CUSTOMER_QUERY)] },
  component: CustomersRouteComponent,
})

function CustomersRouteComponent() {
  const query = useSearch({ from: customersRoute.id })
  const navigate = useNavigate()

  return (
    <CustomerListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/customers', search: next, replace: true })}
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
    />
  )
}

/**
 * A customer's detail page. `/customers/$customerId?tab=` — the id is a path
 * param, the open section a search param, so a customer's invoices or wallet is
 * a link. Overview is the default and stays out of the address bar.
 */
const customerDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/$customerId',
  validateSearch: (search: Record<string, unknown>): { tab: CustomerTab } => ({
    tab: parseCustomerTab(search['tab']),
  }),
  search: { middlewares: [stripSearchParams({ tab: 'overview' })] },
  component: CustomerDetailRouteComponent,
})

function CustomerDetailRouteComponent() {
  const { customerId } = customerDetailRoute.useParams()
  const { tab } = customerDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <CustomerDetailPage
      customerId={customerId}
      tab={tab}
      onTabChange={(next) =>
        void navigate({
          to: '/customers/$customerId',
          params: { customerId },
          search: { tab: next },
          replace: true,
        })
      }
      onNavigateToList={() => void navigate({ to: '/customers', search: {} as never })}
      onCreateSubscription={() => void navigate({ to: '/subscriptions/new', search: {} as never })}
    />
  )
}

const subscriptionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/subscriptions',
  validateSearch: (search: Record<string, unknown>): SubscriptionQuery =>
    parseSubscriptionSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_SUBSCRIPTION_QUERY)] },
  component: SubscriptionsRouteComponent,
})

function SubscriptionsRouteComponent() {
  const query = useSearch({ from: subscriptionsRoute.id })
  const navigate = useNavigate()

  return (
    <SubscriptionListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/subscriptions', search: next, replace: true })}
      onCreate={() => void navigate({ to: '/subscriptions/new', search: {} as never })}
    />
  )
}

const paymentsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/payments',
  validateSearch: (search: Record<string, unknown>): PaymentQuery => parsePaymentSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_PAYMENT_QUERY)] },
  component: PaymentsRouteComponent,
})

function PaymentsRouteComponent() {
  const query = useSearch({ from: paymentsRoute.id })
  const navigate = useNavigate()

  return (
    <PaymentListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/payments', search: next, replace: true })}
    />
  )
}

const creditNotesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/credit-notes',
  validateSearch: (search: Record<string, unknown>): CreditNoteQuery =>
    parseCreditNoteSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_CREDIT_NOTE_QUERY)] },
  component: CreditNotesRouteComponent,
})

function CreditNotesRouteComponent() {
  const query = useSearch({ from: creditNotesRoute.id })
  const navigate = useNavigate()

  return (
    <CreditNoteListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/credit-notes', search: next, replace: true })}
    />
  )
}

const usageSyncsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/usage-syncs',
  validateSearch: (search: Record<string, unknown>): UsageSyncQuery => parseUsageSyncSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_USAGE_SYNC_QUERY)] },
  component: UsageSyncsRouteComponent,
})

function UsageSyncsRouteComponent() {
  const query = useSearch({ from: usageSyncsRoute.id })
  const navigate = useNavigate()

  return (
    <UsageSyncListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/usage-syncs', search: next, replace: true })}
    />
  )
}

const workflowsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/workflows',
  validateSearch: (search: Record<string, unknown>): WorkflowQuery => parseWorkflowSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_WORKFLOW_QUERY)] },
  component: WorkflowsRouteComponent,
})

function WorkflowsRouteComponent() {
  const query = useSearch({ from: workflowsRoute.id })
  const navigate = useNavigate()

  return (
    <WorkflowListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/workflows', search: next, replace: true })}
    />
  )
}

const exportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/exports',
  validateSearch: (search: Record<string, unknown>): DataExportQuery => parseDataExportSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_DATA_EXPORT_QUERY)] },
  component: ExportsRouteComponent,
})

function ExportsRouteComponent() {
  const query = useSearch({ from: exportsRoute.id })
  const navigate = useNavigate()

  return (
    <ExportListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/exports', search: next, replace: true })}
    />
  )
}

const integrationsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/integrations',
  component: IntegrationListPage,
})

const pricingWidgetRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/pricing-widget',
  component: PricingWidgetPage,
})

const taxesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/taxes',
  validateSearch: (search: Record<string, unknown>): TaxRateQuery => parseTaxSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_TAX_RATE_QUERY)] },
  component: TaxesRouteComponent,
})

function TaxesRouteComponent() {
  const query = useSearch({ from: taxesRoute.id })
  const navigate = useNavigate()

  return (
    <TaxListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/taxes', search: next, replace: true })}
    />
  )
}

const eventsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/events',
  validateSearch: (search: Record<string, unknown>): RawEventQuery => parseEventSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_RAW_EVENT_QUERY)] },
  component: EventsRouteComponent,
})

function EventsRouteComponent() {
  const query = useSearch({ from: eventsRoute.id })
  const navigate = useNavigate()

  return (
    <EventListPage
      query={query}
      onQueryChange={(next) => void navigate({ to: '/events', search: next, replace: true })}
    />
  )
}

/**
 * Settings, with both navigation levels in the address bar.
 *
 * The section rail and the tab strip inside it are each a search param, so a
 * link lands on the exact panel rather than one level short of it. `parseSettingsSearch`
 * is total and resolves the tab *against* the section, so a stale or
 * hand-edited pair (`?section=developers&tab=members` — two real ids that do
 * not go together) degrades to something coherent instead of rendering blank.
 *
 * `stripSearchParams` keeps the default pair out of the URL, so the address is
 * `/settings` rather than `/settings?section=organization&tab=profile`.
 */
const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  validateSearch: (search: Record<string, unknown>): SettingsQuery => parseSettingsSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_SETTINGS_QUERY)] },
  component: SettingsRouteComponent,
})

function SettingsRouteComponent() {
  const { section, tab } = useSearch({ from: settingsRoute.id })
  const navigate = useNavigate()

  return (
    <SettingsPage
      sectionId={section}
      tabId={tab}
      /*
       * One navigation for both ids. Changing section also changes tab — the
       * shell reports only the section, and the page picks that section's
       * first tab — and writing them separately would put an impossible pair
       * in the URL for one render and cost two entries of history.
       *
       * `replace` because flipping through tabs should not fill the Back
       * stack, same as every list route here.
       */
      onNavigate={(nextSection, nextTab) =>
        void navigate({
          to: '/settings',
          search: { section: nextSection, tab: nextTab },
          replace: true,
        })
      }
    />
  )
}

/**
 * Developer destinations that already have a home in Settings.
 *
 * API keys, service accounts and webhooks are built as Settings → Developers
 * panels; the sidebar links them at their own paths, so each lands on its
 * panel rather than duplicating it as a second page.
 */
const developerRedirects = [
  ['/api-keys', 'api-keys'],
  ['/service-accounts', 'service-accounts'],
  ['/webhooks', 'webhooks'],
].map(([path, tab]) =>
  createRoute({
    getParentRoute: () => shellRoute,
    path: path as string,
    beforeLoad: () => {
      throw redirect({
        to: '/settings',
        search: { section: 'developers', tab } as never,
        replace: true,
      })
    },
  }),
)

export const routeTree = rootRoute.addChildren([
  signInRoute,
  shellRoute.addChildren([
    homeRoute,
    revenueRoute,
    featuresRoute,
    featureCreateRoute,
    featureDetailRoute,
    plansRoute,
    planDetailRoute,
    addonsRoute,
    addonDetailRoute,
    couponsRoute,
    couponDetailRoute,
    priceUnitsRoute,
    priceUnitDetailRoute,
    groupsRoute,
    groupDetailRoute,
    costSheetsRoute,
    costSheetDetailRoute,
    customersRoute,
    customerDetailRoute,
    subscriptionsRoute,
    invoicesRoute,
    paymentsRoute,
    creditNotesRoute,
    workflowsRoute,
    exportsRoute,
    pricingWidgetRoute,
    integrationsRoute,
    usageSyncsRoute,
    taxesRoute,
    eventsRoute,
    settingsRoute,
    subscriptionCreateRoute,
    ...developerRedirects,
    ...placeholderRoutes,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
