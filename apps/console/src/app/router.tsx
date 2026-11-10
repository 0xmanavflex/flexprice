import { legacyDestination } from './legacyRoutes'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import {
  type ErrorComponentProps,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  retainSearchParams,
  stripSearchParams,
  useCanGoBack,
  useNavigate,
  useParams,
  useRouter,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { Navigate, Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { AccessProvider, AppFailure, ErrorState, PageLoadingState } from '@fp/ui/compositions'
import { useAccessControl, useCurrentUser, useSelfBillingStatus } from '@fp/query'
import { toListFailure } from '@/pages/shared/listFailure'
import { ConsoleShell } from './shell/ConsoleShell'
import { useListMemory } from './shell/useListMemory'
import { hasSession, needsSignIn, useSession } from './session'
import { AnalyticsIdentity, captureError } from './analytics'
import { listPathAfterEnvironmentSwitch } from './shell/environmentSwitch'
import { useEnvironments } from './shell/useEnvironments'
import {
  ENVIRONMENT_PARAM,
  parseEnvironmentParam,
  useEnvironmentInUrl,
} from './shell/environmentInUrl'
import { DOCS_URL } from './shell/navigation'
import type { InvoiceQuery, RollforwardAccount } from '@fp/domain'
const InvoiceFormPage = lazy(() =>
  import('@/pages/invoices/InvoiceFormPage').then((m) => ({ default: m.InvoiceFormPage })),
)
const InvoiceEditPage = lazy(() =>
  import('@/pages/invoices/InvoiceEditPage').then((m) => ({ default: m.InvoiceEditPage })),
)
const PaymentFormPage = lazy(() =>
  import('@/pages/payments/PaymentFormPage').then((m) => ({ default: m.PaymentFormPage })),
)
const PaymentDetailPage = lazy(() =>
  import('@/pages/payments/PaymentDetailPage').then((m) => ({ default: m.PaymentDetailPage })),
)
const CreditNoteFormPage = lazy(() =>
  import('@/pages/credit-notes/CreditNoteFormPage').then((m) => ({
    default: m.CreditNoteFormPage,
  })),
)
const CreditNoteDetailPage = lazy(() =>
  import('@/pages/credit-notes/CreditNoteDetailPage').then((m) => ({
    default: m.CreditNoteDetailPage,
  })),
)
const InvoiceDetailPage = lazy(() =>
  import('@/pages/invoices/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })),
)
const InvoiceListPage = lazy(() =>
  import('@/pages/invoices/InvoiceListPage').then((m) => ({ default: m.InvoiceListPage })),
)
import { DEFAULT_INVOICE_QUERY } from '@fp/domain'
import { parseInvoiceSearch } from './searchParams'
const SubscriptionFormPage = lazy(() =>
  import('@/pages/subscriptions/SubscriptionFormPage').then((m) => ({
    default: m.SubscriptionFormPage,
  })),
)
import { DEFAULT_STEP, parseStep, toStepSearch } from './subscriptionSteps'
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
const PlanAiSetupPage = lazy(() =>
  import('@/pages/plans/PlanAiSetupPage').then((m) => ({ default: m.PlanAiSetupPage })),
)
const PlanFormPage = lazy(() =>
  import('@/pages/plans/PlanFormPage').then((m) => ({ default: m.PlanFormPage })),
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
import { parseActivitySearch, type ActivitySearch } from '@/pages/customers/activitySearch'
const BillingEntityFormPage = lazy(() =>
  import('@/pages/settings/billing-entities/BillingEntityFormPage').then((m) => ({
    default: m.BillingEntityFormPage,
  })),
)
const BillingEntityDetailPage = lazy(() =>
  import('@/pages/settings/billing-entities/BillingEntityDetailPage').then((m) => ({
    default: m.BillingEntityDetailPage,
  })),
)
import { parseBillingEntityTab } from '@/pages/settings/billing-entities/BillingEntityDetailPage'
const CustomerFormPage = lazy(() =>
  import('@/pages/customers/CustomerFormPage').then((m) => ({ default: m.CustomerFormPage })),
)
const CustomerSubscriptionFormPage = lazy(() =>
  import('@/pages/subscriptions/CustomerSubscriptionFormPage').then((m) => ({
    default: m.CustomerSubscriptionFormPage,
  })),
)
import {
  parseSubscriptionTab,
  type BillingEntityTab,
  type CustomerTab,
  type SubscriptionTab,
} from '@fp/ui/pages'
import { parseCustomerSearch } from './customerSearch'
import { DEFAULT_CUSTOMER_QUERY, type CustomerQuery } from '@fp/domain'
const SubscriptionListPage = lazy(() =>
  import('@/pages/subscriptions/SubscriptionListPage').then((m) => ({
    default: m.SubscriptionListPage,
  })),
)
const SubscriptionDetailPage = lazy(() =>
  import('@/pages/subscriptions/SubscriptionDetailPage').then((m) => ({
    default: m.SubscriptionDetailPage,
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
const PricingWidgetPage = lazy(() =>
  import('@/pages/pricing-widget/PricingWidgetPage').then((m) => ({
    default: m.PricingWidgetPage,
  })),
)
const OAuthCallbackPage = lazy(() =>
  import('@/pages/integrations/OAuthCallbackPage').then((m) => ({
    default: m.OAuthCallbackPage,
  })),
)
const IntegrationListPage = lazy(() =>
  import('@/pages/integrations/IntegrationListPage').then((m) => ({
    default: m.IntegrationListPage,
  })),
)
const ProviderConnectionsPage = lazy(() =>
  import('@/pages/integrations/ProviderConnectionsPage').then((m) => ({
    default: m.ProviderConnectionsPage,
  })),
)
const ExportListPage = lazy(() =>
  import('@/pages/exports/ExportListPage').then((m) => ({ default: m.ExportListPage })),
)
const S3ConnectionsPage = lazy(() =>
  import('@/pages/exports/S3ConnectionsPage').then((m) => ({ default: m.S3ConnectionsPage })),
)
const ConnectionExportsPage = lazy(() =>
  import('@/pages/exports/ConnectionExportsPage').then((m) => ({
    default: m.ConnectionExportsPage,
  })),
)
const DataExportDetailPage = lazy(() =>
  import('@/pages/exports/DataExportDetailPage').then((m) => ({
    default: m.DataExportDetailPage,
  })),
)
import { parseDataExportSearch } from './dataExportSearch'
import { parseEventImportSearch } from './eventImportSearch'
const EventImportsPage = lazy(() =>
  import('@/pages/imports/EventImportsPage').then((m) => ({ default: m.EventImportsPage })),
)
import {
  DEFAULT_DATA_EXPORT_QUERY,
  DEFAULT_EVENT_IMPORT_QUERY,
  type DataExportQuery,
  type EventImportQuery,
} from '@fp/domain'
const UsageSyncListPage = lazy(() =>
  import('@/pages/usage-syncs/UsageSyncListPage').then((m) => ({ default: m.UsageSyncListPage })),
)
import { parseUsageSyncSearch } from './usageSyncSearch'
import { DEFAULT_USAGE_SYNC_QUERY, type UsageSyncQuery } from '@fp/domain'
import { parseOpenWorkflowRun, parseWorkflowSearch } from './workflowSearch'
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
const SettingsFrame = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsFrame })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
import { DEFAULT_SETTINGS_QUERY, type SettingsQuery, parseSettingsSearch } from './settingsSearch'
import { MOVED_SECTIONS } from '@/pages/settings/sections'
import { SupportChat } from '@/app/supportChat/SupportChat'
import { VersionCheck } from '@/app/versionCheck/VersionCheck'
import { AccountLockProvider, AccountPill, useLockedAccess } from '@/app/selfBilling/AccountLock'
import { EnvironmentToaster } from '@/pages/shared/RecordElsewhere'
import { RouteAccessGate } from '@/app/access/RouteAccessGate'
import { DEFAULT_HOME_SEARCH, parseHomeSearch, type HomeSearch } from '@/app/homeSearch'
import { DEFAULT_REVENUE_SEARCH, parseRevenueSearch, type RevenueSearch } from '@/app/revenueSearch'
import {
  DEFAULT_REVENUE_RECOGNITION_SEARCH,
  parseRevenueRecognitionSearch,
  type RevenueRecognitionSearch,
} from '@/app/revenueRecognitionSearch'
import {
  DEFAULT_ROLLFORWARD_SEARCH,
  parseRollforwardSearch,
  type RollforwardSearch,
} from '@/app/rollforwardSearch'
const WebhooksPage = lazy(() =>
  import('@/pages/webhooks/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
)
const WebhookEndpointCreatePage = lazy(() =>
  import('@/pages/webhooks/WebhookEndpointCreatePage').then((m) => ({
    default: m.WebhookEndpointCreatePage,
  })),
)
const WebhookEndpointDetailPage = lazy(() =>
  import('@/pages/webhooks/WebhookEndpointDetailPage').then((m) => ({
    default: m.WebhookEndpointDetailPage,
  })),
)
import {
  type WebhookEndpointSearch,
  type WebhookHubSearch,
  parseWebhookEndpointSearch,
  parseWebhookHubSearch,
} from './webhookSearch'

const FeatureFormPage = lazy(() =>
  import('@/pages/features/FeatureFormPage').then((m) => ({ default: m.FeatureFormPage })),
)
const FeatureDetailPage = lazy(() =>
  import('@/pages/features/FeatureDetailPage').then((m) => ({ default: m.FeatureDetailPage })),
)
const AddonFormPage = lazy(() =>
  import('@/pages/addons/AddonFormPage').then((m) => ({ default: m.AddonFormPage })),
)
const CouponFormPage = lazy(() =>
  import('@/pages/coupons/CouponFormPage').then((m) => ({ default: m.CouponFormPage })),
)
const CostSheetFormPage = lazy(() =>
  import('@/pages/cost-sheets/CostSheetFormPage').then((m) => ({ default: m.CostSheetFormPage })),
)
const AddonDetailPage = lazy(() =>
  import('@/pages/addons/AddonDetailPage').then((m) => ({ default: m.AddonDetailPage })),
)
const PriceUnitDetailPage = lazy(() =>
  import('@/pages/price-units/PriceUnitDetailPage').then((m) => ({
    default: m.PriceUnitDetailPage,
  })),
)
const PriceUnitFormPage = lazy(() =>
  import('@/pages/price-units/PriceUnitFormPage').then((m) => ({ default: m.PriceUnitFormPage })),
)
const GroupFormPage = lazy(() =>
  import('@/pages/groups/GroupFormPage').then((m) => ({ default: m.GroupFormPage })),
)
const GroupDetailPage = lazy(() =>
  import('@/pages/groups/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })),
)
const TaxFormPage = lazy(() =>
  import('@/pages/taxes/TaxFormPage').then((m) => ({ default: m.TaxFormPage })),
)
const TaxRateDetailPage = lazy(() =>
  import('@/pages/taxes/TaxRateDetailPage').then((m) => ({ default: m.TaxRateDetailPage })),
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
const RollforwardPage = lazy(() =>
  import('@/pages/revenue/RollforwardPage').then((m) => ({ default: m.RollforwardPage })),
)
const RevenueRecognitionPage = lazy(() =>
  import('@/pages/revenue/RevenueRecognitionPage').then((m) => ({
    default: m.RevenueRecognitionPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/pages/revenue/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
/*
 * Not lazy, unlike every other page.
 *
 * It is the first thing a signed-out visitor sees, so putting it behind a
 * second network round trip buys a blank screen on the one route that has no
 * shell to render a spinner into.
 */
import { SignInPage } from '@/pages/auth/SignInPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage'
import { SignUpConfirmPage } from '@/pages/auth/SignUpConfirmPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { SetPasswordPage } from '@/pages/auth/SetPasswordPage'
import { passwordLinksAvailableFor } from '@/app/auth/passwordLink'
import { ChangePasswordDialog } from '@/app/shell/ChangePasswordDialog'
import { useRegion } from '@/app/region'
import { OnboardingPage } from '@/pages/auth/OnboardingPage'

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
 * that records why it is not yet a request: see the note there.
 */
function ShellLayout() {
  const navigate = useNavigate()
  const { pathname, searchStr } = useRouterState({ select: (state) => state.location })
  const params = useParams({ strict: false })
  const environments = useEnvironments()
  // Every page's address names its environment (`?env=`): a shared link opens there.
  useEnvironmentInUrl(environments)
  const { session, signOut, environmentId } = useSession()
  /*
   * Who is signed in, when anyone is.
   *
   * The hook is a no-op without a token, so under mocks and behind an API key
   * this costs nothing and simply never resolves: which is why the fallbacks
   * below are the normal case there rather than an error state.
   */
  const currentUser = useCurrentUser(session?.token ?? null)
  const user = currentUser.data
  // What the signed-in principal may see and do: roles from `/users/me`,
  // resolved against the role catalogue (V1's `useCurrentUserPermissions`).
  // Waits for an environment: the role catalogue needs X-Environment-ID.
  const roleAccess = useAccessControl(session?.token ?? null, { environmentId })
  // A locked (read-only) account writes nothing, whatever the roles.
  const signedIn = Boolean(session?.token && environmentId)
  const selfBilling = useSelfBillingStatus({ enabled: signedIn })
  const access = useLockedAccess(
    roleAccess,
    Boolean(selfBilling.data?.enabled && selfBilling.data.state === 'suspended'),
  )

  // Each list's filters, kept across a trip into a detail page and back.
  useListMemory()
  const { region } = useRegion()
  const [changingPassword, setChangingPassword] = useState(false)

  return (
    <AccountLockProvider enabled={signedIn}>
      <AccessProvider value={access}>
        <ConsoleShell
          pathname={pathname}
          search={searchStr}
          onNavigate={(path) => {
            // A row may carry the search that selects it (a Settings tab).
            const [to = path, query = ''] = path.split('?')
            void navigate({
              to,
              search: Object.fromEntries(new URLSearchParams(query)) as never,
            })
          }}
          environment={environments.current}
          environments={environments.environments}
          onEnvironmentChange={(id) => {
            if (id === environments.current.id) return
            environments.select(id)
            // An id from the old environment does not exist in the new one.
            const list = listPathAfterEnvironmentSwitch(pathname, params)
            if (list) void navigate({ to: list, search: {} as never })
          }}
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
          // Self-hosted only, and only for a person signed in with a password:
          // hosted accounts change theirs through Supabase, and an API key has
          // no password to change (the API refuses it).
          {...(passwordLinksAvailableFor(region) &&
          session?.token &&
          user?.type !== 'service_account'
            ? { onChangePassword: () => setChangingPassword(true) }
            : {})}
          onSignOut={() => {
            signOut()
            void navigate({ to: '/sign-in', search: {} as never })
          }}
          // Help: the support chat, when a provider is configured (as in V1).
          // The trial chip leads, left of search: trial chip, search, Create.
          headerLeading={<AccountPill />}
          headerActions={
            <>
              <SupportChat />
              <AnalyticsIdentity />
            </>
          }
        >
          {/* A route's chunk is fetched on navigation; this is what shows meanwhile. */}
          {/*
        Keyed by environment, so switching remounts the page. Cached rows are
        already kept apart by environment; what the key protects is page state:
        a half-filled form or an open dialog that belongs to an entity of the
        environment just left must not survive into one where that entity does
        not exist, and be saved there.
      */}
          <Suspense key={environments.current.id} fallback={<PageLoadingState />}>
            {/* Each route's access, from one table (`app/access/routeAccess.ts`). */}
            <RouteAccessGate>
              <Outlet />
            </RouteAccessGate>
          </Suspense>
        </ConsoleShell>
        <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
        {/* Toasters render a <section> each; inside the header cluster every one
          added a flex gap between search and Create. */}
        <VersionCheck />
        <EnvironmentToaster />
      </AccessProvider>
    </AccountLockProvider>
  )
}

/**
 * What a route that threw renders, in place of the page.
 *
 * Two things reach here: a query that failed with a server fault and had no
 * data to fall back on (`throwOnError`, see `@fp/query`), and everything else:
 * a render bug, a chunk that no longer exists. Both get the same screen,
 * because from the chair it is the same event: this page did not load.
 *
 * It is the router's `defaultErrorComponent`, so the boundary is *per route*
 * and sits inside the shell: the sidebar and the environment picker stay
 * usable, and one broken page is never the whole console.
 *
 * Retry has to undo two things. The router's own match is in the error state,
 * and TanStack Query remembers that the query errored and would rethrow it on
 * the next render; resetting only one leaves the page failing instantly again.
 * The failure's `kind` picks the words and withholds the retry button where it
 * cannot help (a permission error never offers one).
 */
function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrors = useQueryErrorResetBoundary()
  const failure = toListFailure(error, 'this page')

  // A page that crashed is worth knowing about; one the API refused is not a bug.
  useEffect(() => {
    if (failure?.kind === 'generic' || failure?.kind === undefined) {
      captureError(error, { source: 'route-error' })
    }
  }, [error, failure?.kind])

  const retry = () => {
    queryErrors.reset()
    reset()
    void router.invalidate()
  }

  return (
    <ErrorState
      variant="page"
      title={
        failure?.kind === 'denied'
          ? 'You do not have access to this page'
          : 'This page could not be loaded'
      }
      description={
        failure?.kind === 'generic' || failure?.kind === undefined
          ? 'The rest of the console still works. Try again, or pick another page.'
          : failure.message
      }
      kind={failure?.kind ?? 'generic'}
      {...(failure?.canRetry === false ? {} : { onRetry: retry })}
      retryAfterMs={failure?.retryAfterMs}
    />
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
   * Without this a thrown route: including a rejected lazy import: renders
   * nothing at all, and a crash is indistinguishable from an empty list.
   */
  /**
   * A mistyped or retired URL. Distinct from `errorComponent`, which is for a
   * page that exists and broke: the two need different words and different
   * ways out.
   */
  notFoundComponent: () => (
    <AppFailure
      title="There is no page at this address"
      detail="The link may be out of date, or the address mistyped. Everything in the sidebar still works."
    />
  ),
  errorComponent: RouteError,
})

/**
 * The console proper: every route that requires a session.
 *
 * A pathless layout route: it contributes no path segment, only the shell and
 * the guard. Adding a route to the console means parenting it here; a route
 * parented to `rootRoute` is deliberately opting out of both.
 */
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_shell',
  // `?env=<environment id>` on every console page, kept across navigation so
  // in-app links need not repeat it. See `shell/environmentInUrl.ts`.
  validateSearch: (search: Record<string, unknown>) => parseEnvironmentParam(search),
  search: { middlewares: [retainSearchParams([ENVIRONMENT_PARAM])] },
  /**
   * The guard, in `beforeLoad` rather than in a component.
   *
   * A guard that runs during render has already mounted the shell, so a
   * signed-out visitor sees the sidebar and a flash of empty lists before being
   * moved on. `beforeLoad` runs before any of that, and it can do so
   * synchronously because the session lives in `localStorage`: see
   * `session/guard.ts` for why mocks and an API key are exempt.
   *
   * The address being turned away is carried along, so a bookmarked
   * `/invoices?status=overdue` still resolves after signing in instead of
   * dumping the user on the home page.
   */
  beforeLoad: ({ location }) => {
    if (needsSignIn()) {
      // `sso` is part of the sign-in search now; the guard names no tenant.
      throw redirect({ to: '/sign-in', search: { redirect: location.href, sso: undefined } })
    }
  },
  component: ShellLayout,
})

/**
 * Sign in: the one route outside the shell.
 *
 * Already signed in, it steps aside rather than offering a second sign-in: a
 * form that re-authenticates a user who is already authenticated is a way to
 * lose a working session to a typo. It steps aside only for a *real* session,
 * not for the bypasses: under mocks there is nobody signed in, and the page
 * still has to be reachable for the fixture-backed end-to-end suite.
 */
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string | undefined; sso: string | undefined } => ({
    redirect: typeof search['redirect'] === 'string' ? search['redirect'] : undefined,
    // The tenant whose identity provider should handle this login. SSO is
    // per tenant, so it arrives in the link an administrator hands out.
    sso: typeof search['sso'] === 'string' ? search['sso'] : undefined,
  }),
  beforeLoad: () => {
    if (hasSession()) throw redirect({ to: '/' })
  },
  component: SignInRouteComponent,
})

/** Create an account. Outside the shell like sign-in, and steps aside for a real session. */
const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  beforeLoad: () => {
    if (hasSession()) throw redirect({ to: '/' })
  },
  component: SignUpPage,
})

/**
 * Where a SAML assertion lands.
 *
 * The backend's `auth.saml.dashboard_url` points here and arrives with the
 * token in the URL fragment. No `validateSearch`: a fragment is not a search
 * string and never reaches the router: the page reads `location.hash`
 * itself and clears it.
 *
 * It does not step aside for an existing session. Someone already signed in
 * to one tenant who completes an SSO login to another must land on the new
 * session, not be bounced to the old one's dashboard.
 */
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
})

/**
 * The far end of the sign-up confirmation email and of Google sign-in. Does not
 * step aside for an existing session: the link must be consumed wherever it
 * lands, or the account it confirms is never created.
 *
 * The path is V1's, because it is the one the Supabase Redirect URLs allow:
 * see `SIGN_UP_CONFIRM_PATH`.
 */
const signUpConfirmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/signup/confirmation',
  component: SignUpConfirmPage,
})

/**
 * The address V2 sent before it adopted V1's path. Confirmation emails already
 * sent still point here, so it renders the same page rather than a 404.
 */
const legacySignUpConfirmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up/confirm',
  component: SignUpConfirmPage,
})

/**
 * Request a reset link, and the far end of one.
 *
 * Both sit outside the shell, like sign-in. Neither steps aside for an existing
 * session: someone already signed in may still be following a reset link from
 * their inbox, and bouncing them to the dashboard would make the link look
 * broken. `/reset-password` in particular must stay reachable: it is the
 * address Supabase emails, and it is the only place the recovery fragment can
 * be consumed.
 */
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
})

/**
 * The far end of a one-time password link (self-hosted). Like
 * `/reset-password`, it does not step aside for an existing session: the link
 * has to be usable wherever it is opened. The token is in the fragment, which
 * the page reads itself.
 */
const setPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/set-password',
  component: SetPasswordPage,
})

/**
 * V1's address for the same page, `/auth?tab=set-password#token=…`, which links
 * already handed out still carry. Sent on with the fragment; any other `/auth`
 * visit goes to sign-in, as V1's `/auth` was its sign-in page.
 */
const legacyAuthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  beforeLoad: ({ location }) => {
    const tab = new URLSearchParams(location.searchStr).get('tab')
    if (tab === 'set-password') {
      throw redirect({ to: '/set-password', hash: location.hash })
    }
    throw redirect({ to: '/sign-in', search: { redirect: undefined, sso: undefined } })
  },
})

/**
 * Tenant onboarding: the three questions a new workspace answers once.
 *
 * Outside the shell, like sign-up, because it is the step between creating an
 * account and seeing the console. Not public, though: it needs the session
 * whose tenant it updates, so it takes the shell's guard.
 */
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  beforeLoad: ({ location }) => {
    if (needsSignIn()) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href, sso: undefined } })
    }
  },
  component: OnboardingPage,
})

function SignInRouteComponent() {
  const { redirect: target, sso } = signInRoute.useSearch()
  return <SignInPage redirect={target} ssoTenantId={sso} />
}

/**
 * Every destination in the sidebar resolves to something.
 *
 * Before this, twenty of twenty-four navigated to a bare "Not Found": which
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
 * domain object and never parses a string. It is total by construction: a
 * hand-edited URL degrades to defaults rather than throwing.
 */
const invoicesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/invoices',
  validateSearch: (search: Record<string, unknown>): InvoiceQuery => parseInvoiceSearch(search),
  /**
   * Keep defaults out of the address bar.
   *
   * `validateSearch` returns a *complete* query: which is what makes the page
   * type-safe: but TanStack then writes all of it into the URL, so `/invoices`
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
      onCreate={() => void navigate({ to: '/invoices/new' })}
      onRecordPayment={(invoice) => void navigate({ to: '/payments/new', search: { invoice } })}
      onIssueCreditNote={(invoice) =>
        void navigate({ to: '/credit-memos/new', search: { invoice } })
      }
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
      onInvoiceClick={(invoice) =>
        void navigate({ to: '/invoices/$invoiceId', params: { invoiceId: invoice.id } })
      }
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
 * The step lives in the URL: `/contracts/new?step=prices`: so a
 * half-finished subscription is linkable, resumable, and navigable with the
 * back button. See `docs/architecture.md`: the stepper owns presentation, the
 * route owns workflow state.
 */
const subscriptionCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/contracts/new',
  validateSearch: (search: Record<string, unknown>) => ({ step: parseStep(search['step']) }),
  component: SubscriptionCreateRouteComponent,
})

const subscriptionDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/contracts/$subscriptionId',
  // The open tab is a search param, as on a customer, so going back to a
  // contract (from an invoice, a plan, another contract) reopens that tab.
  // Optional, so a plain link to a contract opens it on Overview.
  validateSearch: (search: Record<string, unknown>): { tab?: SubscriptionTab } => {
    const tab = parseSubscriptionTab(search['tab'])
    return tab === 'overview' ? {} : { tab }
  },
  component: SubscriptionDetailRouteComponent,
})

function SubscriptionDetailRouteComponent() {
  const { subscriptionId } = subscriptionDetailRoute.useParams()
  const { tab } = subscriptionDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <SubscriptionDetailPage
      subscriptionId={subscriptionId}
      tab={tab ?? 'overview'}
      onTabChange={(next) =>
        void navigate({
          to: '/contracts/$subscriptionId',
          params: { subscriptionId },
          search: next === 'overview' ? {} : { tab: next },
          replace: true,
        })
      }
      onNavigateToList={() => void navigate({ to: '/contracts', search: {} as never })}
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
      onOpenPlan={(planId) =>
        void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
      }
      onOpenContract={(id) =>
        void navigate({
          to: '/contracts/$subscriptionId',
          params: { subscriptionId: id },
          search: {} as never,
        })
      }
      onOpenInvoice={(invoiceId) =>
        void navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
      }
    />
  )
}

function SubscriptionCreateRouteComponent() {
  const { step } = subscriptionCreateRoute.useSearch()
  const navigate = useNavigate()

  return (
    <SubscriptionFormPage
      {...(step === DEFAULT_STEP ? {} : { step })}
      onStepChange={(next) =>
        void navigate({
          to: '/contracts/new',
          search: toStepSearch(parseStep(next)) as never,
          replace: true,
        })
      }
      onCancel={() => void navigate({ to: '/contracts', search: {} as never })}
      onDone={(subscriptionId, draft) =>
        void (draft && subscriptionId
          ? navigate({
              to: '/contracts/$subscriptionId',
              params: { subscriptionId },
              search: {} as never,
            })
          : navigate({ to: '/contracts', search: {} as never }))
      }
    />
  )
}

/**
 * Features: list and create.
 *
 * The first migrated V1 surface. The query lives in search params, so a
 * filtered list is a link: which V1's version cannot produce.
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
      onCreateFeature={() => void navigate({ to: '/features/new' })}
      onEditFeature={(feature) =>
        void navigate({ to: '/features/$featureId/edit', params: { featureId: feature.id } })
      }
    />
  )
}

/**
 * Feature create and edit are full pages: `/features/new` and
 * `/features/$featureId/edit`, the step in `?step=` so a half-finished flow is a link.
 */
const featureCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/features/new',
  component: FeatureCreateRouteComponent,
})

function FeatureCreateRouteComponent() {
  const navigate = useNavigate()

  return (
    <FeatureFormPage
      mode="create"
      onCancel={() => void navigate({ to: '/features', search: {} as never })}
      onDone={(featureId) => void navigate({ to: '/features/$featureId', params: { featureId } })}
    />
  )
}

const featureEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/features/$featureId/edit',
  component: FeatureEditRouteComponent,
})

function FeatureEditRouteComponent() {
  const { featureId } = featureEditRoute.useParams()
  const navigate = useNavigate()
  const toDetail = (id: string) =>
    void navigate({ to: '/features/$featureId', params: { featureId: id } })

  return (
    <FeatureFormPage
      mode="edit"
      featureId={featureId}
      onCancel={() => toDetail(featureId)}
      onDone={toDetail}
    />
  )
}

/** The feature detail page. `/features/$featureId`: the id is a path param. */
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
      onEdit={(id) => void navigate({ to: '/features/$featureId/edit', params: { featureId: id } })}
      onNavigateToList={() => void navigate({ to: '/features', search: {} as never })}
    />
  )
}

/**
 * Plans: the list, plus a create/edit drawer the page owns.
 *
 * Same URL-as-query contract as features and invoices: a filtered, sorted,
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
      onCreatePlan={() => void navigate({ to: '/plans/new' })}
      onCreateWithAi={() => void navigate({ to: '/plans/ai' })}
      onEditPlan={(planId) =>
        void navigate({ to: '/plans/$planId/edit', params: { planId }, search: {} as never })
      }
    />
  )
}

/**
 * `/plans/ai`: describe a pricing page, review what it would create, create
 * it. A page of its own rather than a dialog: what comes back is long enough
 * to scroll, and leaving half way should cost nothing.
 */
const planAiRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/plans/ai',
  component: PlanAiRouteComponent,
})

function PlanAiRouteComponent() {
  const navigate = useNavigate()
  return <PlanAiSetupPage onDone={() => void navigate({ to: '/plans', search: {} as never })} />
}

/**
 * Plan create and edit are full pages: `/plans/new` and `/plans/$planId/edit`,
 * the step in `?step=` so a half-finished flow is a link.
 */
const planCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/plans/new',
  validateSearch: (search: Record<string, unknown>): { step?: string } =>
    typeof search.step === 'string' ? { step: search.step } : {},
  component: PlanCreateRouteComponent,
})

function PlanCreateRouteComponent() {
  const navigate = useNavigate()
  const { step } = planCreateRoute.useSearch()

  return (
    <PlanFormPage
      mode="create"
      {...(step ? { step } : {})}
      onStepChange={(next) =>
        void navigate({ to: '/plans/new', search: { step: next }, replace: true })
      }
      onCancel={() => void navigate({ to: '/plans', search: {} as never })}
      onDone={(planId) =>
        void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
      }
    />
  )
}

const planEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/plans/$planId/edit',
  validateSearch: (search: Record<string, unknown>): { step?: string } =>
    typeof search.step === 'string' ? { step: search.step } : {},
  component: PlanEditRouteComponent,
})

function PlanEditRouteComponent() {
  const { planId } = planEditRoute.useParams()
  const { step } = planEditRoute.useSearch()
  const navigate = useNavigate()
  const toDetail = (id: string) =>
    void navigate({ to: '/plans/$planId', params: { planId: id }, search: {} as never })

  return (
    <PlanFormPage
      mode="edit"
      planId={planId}
      {...(step ? { step } : {})}
      onStepChange={(next) =>
        void navigate({
          to: '/plans/$planId/edit',
          params: { planId },
          search: { step: next },
          replace: true,
        })
      }
      onCancel={() => toDetail(planId)}
      onDone={toDetail}
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
      onEdit={(id) => void navigate({ to: '/plans/$planId/edit', params: { planId: id } })}
      onArchived={() => void navigate({ to: '/plans', search: {} as never })}
      onNavigateToList={() => void navigate({ to: '/plans', search: {} as never })}
      onDuplicated={(newId) =>
        void navigate({ to: '/plans/$planId', params: { planId: newId }, search: {} as never })
      }
    />
  )
}

/**
 * Cancel on a full-page form returns to wherever the user came from (the list
 * or the detail page), and falls back to `fallback` on a direct visit.
 */
function useCancelToList(fallback: string, params?: Record<string, string>) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  return () => {
    if (canGoBack) router.history.back()
    else void navigate({ to: fallback, ...(params ? { params } : {}), search: {} as never })
  }
}

/** `?edit=true` opens a detail page with its details already in edit mode. */
function parseEditSearch(search: Record<string, unknown>): { edit?: boolean } {
  return search.edit === true || search.edit === 'true' ? { edit: true } : {}
}

const addonCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/addons/new',
  component: AddonCreateRouteComponent,
})

function AddonCreateRouteComponent() {
  const navigate = useNavigate()
  const cancel = useCancelToList('/addons')

  return (
    <AddonFormPage
      mode="create"
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/addons', search: {} as never })}
      onDone={(addonId) => void navigate({ to: '/addons/$addonId', params: { addonId } })}
    />
  )
}

const couponCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/coupons/new',
  component: CouponCreateRouteComponent,
})

function CouponCreateRouteComponent() {
  const navigate = useNavigate()
  const cancel = useCancelToList('/coupons')

  return (
    <CouponFormPage
      mode="create"
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/coupons', search: {} as never })}
      onDone={(couponId) => void navigate({ to: '/coupons/$couponId', params: { couponId } })}
    />
  )
}

const costSheetCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/cost-sheets/new',
  component: CostSheetCreateRouteComponent,
})

function CostSheetCreateRouteComponent() {
  const navigate = useNavigate()
  const cancel = useCancelToList('/cost-sheets')

  return (
    <CostSheetFormPage
      mode="create"
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/cost-sheets', search: {} as never })}
      onDone={(costSheetId) =>
        void navigate({ to: '/cost-sheets/$costSheetId', params: { costSheetId } })
      }
    />
  )
}

const addonEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/addons/$addonId/edit',
  component: AddonEditRouteComponent,
})

function AddonEditRouteComponent() {
  const { addonId } = addonEditRoute.useParams()
  const navigate = useNavigate()
  const cancel = useCancelToList('/addons/$addonId', { addonId })

  return (
    <AddonFormPage
      mode="edit"
      addonId={addonId}
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/addons', search: {} as never })}
      onDone={() => void navigate({ to: '/addons/$addonId', params: { addonId } })}
    />
  )
}

const couponEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/coupons/$couponId/edit',
  component: CouponEditRouteComponent,
})

function CouponEditRouteComponent() {
  const { couponId } = couponEditRoute.useParams()
  const navigate = useNavigate()
  const cancel = useCancelToList('/coupons/$couponId', { couponId })

  return (
    <CouponFormPage
      mode="edit"
      couponId={couponId}
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/coupons', search: {} as never })}
      onDone={() => void navigate({ to: '/coupons/$couponId', params: { couponId } })}
    />
  )
}

const costSheetEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/cost-sheets/$costSheetId/edit',
  component: CostSheetEditRouteComponent,
})

function CostSheetEditRouteComponent() {
  const { costSheetId } = costSheetEditRoute.useParams()
  const navigate = useNavigate()
  const cancel = useCancelToList('/cost-sheets/$costSheetId', { costSheetId })

  return (
    <CostSheetFormPage
      mode="edit"
      costSheetId={costSheetId}
      onCancel={cancel}
      onNavigateToList={() => void navigate({ to: '/cost-sheets', search: {} as never })}
      onDone={() => void navigate({ to: '/cost-sheets/$costSheetId', params: { costSheetId } })}
    />
  )
}

/**
 * Add-ons: the list, plus a create/edit drawer the page owns.
 *
 * The list keeps the URL-as-query contract; the editor is local state, so the
 * route only has to hand the page its query. Creating or editing an add-on
 * happens in a drawer over the list: see `AddonListPage`.
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
      onCreateAddon={() => void navigate({ to: '/addons/new' })}
      onEditAddon={(addon) =>
        void navigate({
          to: '/addons/$addonId',
          params: { addonId: addon.id },
          search: { edit: true },
        })
      }
    />
  )
}

/** The add-on detail page. `/addons/$addonId`: view, and edit its details in place. */
const addonDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/addons/$addonId',
  validateSearch: parseEditSearch,
  component: AddonDetailRouteComponent,
})

function AddonDetailRouteComponent() {
  const { addonId } = addonDetailRoute.useParams()
  const { edit } = addonDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <AddonDetailPage
      addonId={addonId}
      startEditing={edit === true}
      onNavigateToList={() => void navigate({ to: '/addons', search: {} as never })}
    />
  )
}

/**
 * Coupons: the list, plus a read-only detail page with a rename drawer.
 *
 * The list keeps the URL-as-query contract; opening a coupon navigates to
 * `/coupons/$couponId`, which is where the discount, redemptions, window, and:
 * the V2 addition: where the coupon is applied all live. Editing is limited to
 * a rename (the discount is immutable), done in place on the detail page.
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
    <SettingsListFrame sectionId="discounts">
      <CouponListPage
        query={query}
        onQueryChange={(next) => void navigate({ to: '/coupons', search: next, replace: true })}
        onOpenCoupon={(coupon) =>
          void navigate({ to: '/coupons/$couponId', params: { couponId: coupon.id } })
        }
        onCreateCoupon={() => void navigate({ to: '/coupons/new' })}
        onEditCoupon={(coupon) =>
          void navigate({
            to: '/coupons/$couponId/edit',
            params: { couponId: coupon.id },
            search: {} as never,
          })
        }
      />
    </SettingsListFrame>
  )
}

const couponDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/coupons/$couponId',
  validateSearch: parseEditSearch,
  component: CouponDetailRouteComponent,
})

function CouponDetailRouteComponent() {
  const { couponId } = couponDetailRoute.useParams()
  const { edit } = couponDetailRoute.useSearch()
  const navigate = useNavigate()

  // Inside Settings, under Coupons, like a tax rate's page.
  return (
    <SettingsListFrame sectionId="discounts">
      <CouponDetailPage
        couponId={couponId}
        startEditing={edit === true}
        onBack={() => void navigate({ to: '/coupons', search: {} as never })}
        onOpenContract={(subscriptionId) =>
          void navigate({
            to: '/contracts/$subscriptionId',
            params: { subscriptionId },
            search: {} as never,
          })
        }
      />
    </SettingsListFrame>
  )
}

/**
 * Price units: the list, plus a create/edit drawer the page owns.
 *
 * The same shape as add-ons: URL-as-query list, editor in local state: because
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
      onCreatePriceUnit={() => void navigate({ to: '/price-units/new' })}
      onEditPriceUnit={(priceUnit) =>
        void navigate({
          to: '/price-units/$priceUnitId',
          params: { priceUnitId: priceUnit.id },
          search: { edit: true } as never,
        })
      }
    />
  )
}

/** Price unit create is a full page; there is no edit page (only the name changes, in place on the detail). */
const priceUnitCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/price-units/new',
  component: PriceUnitCreateRouteComponent,
})

function PriceUnitCreateRouteComponent() {
  const navigate = useNavigate()
  const toList = () => void navigate({ to: '/price-units', search: {} as never })

  return (
    <PriceUnitFormPage
      onCancel={toList}
      onDone={(id) =>
        id
          ? void navigate({ to: '/price-units/$priceUnitId', params: { priceUnitId: id } })
          : toList()
      }
    />
  )
}

/** The price-unit detail page. `/price-units/$priceUnitId`: view, and edit in place. */
const priceUnitDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/price-units/$priceUnitId',
  validateSearch: parseEditSearch,
  component: PriceUnitDetailRouteComponent,
})

function PriceUnitDetailRouteComponent() {
  const { priceUnitId } = priceUnitDetailRoute.useParams()
  const { edit } = priceUnitDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <PriceUnitDetailPage
      priceUnitId={priceUnitId}
      startEditing={edit === true}
      onNavigateToList={() => void navigate({ to: '/price-units', search: {} as never })}
    />
  )
}

/**
 * Groups and cost sheets: the same URL-as-query contract as the other
 * catalogue lists. Each is read-only for now: the editor is a later surface,
 * the way coupons shipped a list before its editor: so the route only has to
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
    <SettingsListFrame sectionId="tags">
      <GroupListPage
        query={query}
        onQueryChange={(next) => void navigate({ to: '/groups', search: next, replace: true })}
        onOpenGroup={(group) =>
          void navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
        }
        onCreateGroup={() => void navigate({ to: '/groups/new' })}
      />
    </SettingsListFrame>
  )
}

/** Group create is a compact full page. Groups have no update route, so there is no edit. */
const groupCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/groups/new',
  component: GroupCreateRouteComponent,
})

function GroupCreateRouteComponent() {
  const navigate = useNavigate()
  const toList = () => void navigate({ to: '/groups', search: {} as never })

  return <GroupFormPage onCancel={toList} onDone={toList} />
}

/**
 * Environment create used to be this page. Environments are managed from the
 * shell's environment switcher now (Settings no longer lists them), so a
 * bookmark of the old address lands on home, where the switcher is.
 */
const environmentCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/environments/new',
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

/** One tag, as V1's group page: inside Settings, under Tags, like a tax rate. */
const groupDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/groups/$groupId',
  component: GroupDetailRouteComponent,
})

function GroupDetailRouteComponent() {
  const { groupId } = groupDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <SettingsListFrame sectionId="tags">
      <GroupDetailPage
        groupId={groupId}
        onNavigateToList={() =>
          void navigate({ to: '/settings', search: { section: 'tags', tab: 'tags' } })
        }
      />
    </SettingsListFrame>
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
    <SettingsListFrame sectionId="cost-tracking">
      <CostSheetListPage
        query={query}
        onQueryChange={(next) => void navigate({ to: '/cost-sheets', search: next, replace: true })}
        onOpenCostSheet={(costSheet) =>
          void navigate({ to: '/cost-sheets/$costSheetId', params: { costSheetId: costSheet.id } })
        }
        onCreateCostSheet={() => void navigate({ to: '/cost-sheets/new' })}
        onEditCostSheet={(costSheet) =>
          void navigate({
            to: '/cost-sheets/$costSheetId',
            params: { costSheetId: costSheet.id },
            search: { edit: true },
          })
        }
      />
    </SettingsListFrame>
  )
}

/** The cost-sheet detail page. `/cost-sheets/$costSheetId`: a read-only view for now. */
const costSheetDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/cost-sheets/$costSheetId',
  validateSearch: parseEditSearch,
  component: CostSheetDetailRouteComponent,
})

function CostSheetDetailRouteComponent() {
  const { costSheetId } = costSheetDetailRoute.useParams()
  const { edit } = costSheetDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <CostSheetDetailPage
      costSheetId={costSheetId}
      startEditing={edit === true}
      onNavigateToList={() => void navigate({ to: '/cost-sheets', search: {} as never })}
    />
  )
}

/**
 * Home: the ReUI `dashboard-4` block, mounted as installed.
 *
 * The first destination in the sidebar, and the only one that is a dashboard
 * rather than a list. The range, granularity and open metric tab live in the
 * URL, so they are still selected when you come back.
 */
const homeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): HomeSearch => parseHomeSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_HOME_SEARCH)] },
  component: HomeRouteComponent,
})

function HomeRouteComponent() {
  const search = useSearch({ from: homeRoute.id })
  const navigate = useNavigate()
  return (
    <HomePage
      search={search}
      onSearchChange={(next) => void navigate({ to: '/', search: next, replace: true })}
    />
  )
}

/**
 * Reports: the analytics report library (once "Revenue"). The tab, range,
 * comparison and currency live in the URL, so a report can be shared as it is
 * on screen.
 */
const reportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/reports',
  validateSearch: (search: Record<string, unknown>): RevenueSearch => parseRevenueSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_REVENUE_SEARCH)] },
  component: ReportsRouteComponent,
})

function ReportsRouteComponent() {
  const search = useSearch({ from: reportsRoute.id })
  const navigate = useNavigate()
  return (
    <ReportsPage
      search={search}
      onSearchChange={(next) => void navigate({ to: '/reports', search: next, replace: true })}
    />
  )
}

/** Revenue › Revenue recognition: customers × months; the range, page and Details are in the URL. */
const revenueRecognitionRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/revenue-recognition',
  validateSearch: (search: Record<string, unknown>): RevenueRecognitionSearch =>
    parseRevenueRecognitionSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_REVENUE_RECOGNITION_SEARCH)] },
  component: RevenueRecognitionRouteComponent,
})

function RevenueRecognitionRouteComponent() {
  const search = useSearch({ from: revenueRecognitionRoute.id })
  const navigate = useNavigate()
  return (
    <RevenueRecognitionPage
      search={search}
      onSearchChange={(next) =>
        void navigate({ to: '/revenue-recognition', search: next, replace: true })
      }
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
    />
  )
}

/** Revenue › Deferred and Unbilled rollforward: one ended month; month, search and page are in the URL. */
const deferredRollforwardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/deferred-rollforward',
  validateSearch: (search: Record<string, unknown>): RollforwardSearch =>
    parseRollforwardSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_ROLLFORWARD_SEARCH)] },
  component: () => <RollforwardRouteComponent account="deferred_revenue" />,
})

const unbilledRollforwardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/unbilled-rollforward',
  validateSearch: (search: Record<string, unknown>): RollforwardSearch =>
    parseRollforwardSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_ROLLFORWARD_SEARCH)] },
  component: () => <RollforwardRouteComponent account="unbilled_receivable" />,
})

function RollforwardRouteComponent({ account }: { account: RollforwardAccount }) {
  const route = account === 'deferred_revenue' ? deferredRollforwardRoute : unbilledRollforwardRoute
  const search = useSearch({ from: route.id })
  const navigate = useNavigate()
  return (
    <RollforwardPage
      account={account}
      search={search}
      onSearchChange={(next) => void navigate({ to: route.fullPath, search: next, replace: true })}
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
      onOpenInvoice={(invoiceId) =>
        void navigate({ to: '/invoices/$invoiceId', params: { invoiceId }, search: {} as never })
      }
      onOpenSubscription={(subscriptionId) =>
        void navigate({
          to: '/contracts/$subscriptionId',
          params: { subscriptionId },
          search: {} as never,
        })
      }
    />
  )
}

/** The page's old address: links and bookmarks to /revenue land on Reports, filters kept. */
const revenueRedirectRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/revenue',
  validateSearch: (search: Record<string, unknown>): RevenueSearch => parseRevenueSearch(search),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/reports', search, replace: true })
  },
})

/**
 * Billing lists: customers, subscriptions, payments and taxes. The same
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
      onCreateCustomer={() => void navigate({ to: '/customers/new' })}
      onEditCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId/edit', params: { customerId } })
      }
    />
  )
}

/**
 * Customer create and edit are full pages: `/customers/new` and
 * `/customers/$customerId/edit`.
 */
const customerCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/new',
  component: CustomerCreateRouteComponent,
})

function CustomerCreateRouteComponent() {
  const navigate = useNavigate()

  return (
    <CustomerFormPage
      mode="create"
      onCancel={() => void navigate({ to: '/customers', search: {} as never })}
      onDone={(customerId) =>
        void navigate({
          to: '/customers/$customerId',
          params: { customerId },
          search: {} as never,
        })
      }
    />
  )
}

const customerEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/$customerId/edit',
  component: CustomerEditRouteComponent,
})

function CustomerEditRouteComponent() {
  const { customerId } = customerEditRoute.useParams()
  const navigate = useNavigate()
  const toDetail = (id: string) =>
    void navigate({ to: '/customers/$customerId', params: { customerId: id }, search: {} as never })

  return (
    <CustomerFormPage
      mode="edit"
      customerId={customerId}
      onCancel={() => toDetail(customerId)}
      onDone={toDetail}
    />
  )
}

/**
 * Create a subscription for a customer who is already open.
 *
 * `/customers/$customerId/contracts/new`: the id is the path, so the form
 * does not ask which customer this is. Cancel returns to that customer's
 * Overview tab.
 */
const customerSubscriptionCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/$customerId/contracts/new',
  component: CustomerSubscriptionCreateRouteComponent,
})

function CustomerSubscriptionCreateRouteComponent() {
  const { customerId } = customerSubscriptionCreateRoute.useParams()
  const navigate = useNavigate()
  const back = () =>
    void navigate({
      to: '/customers/$customerId',
      params: { customerId },
      search: { tab: 'overview' },
    })

  return <CustomerSubscriptionFormPage customerId={customerId} onCancel={back} />
}

/**
 * A customer's detail page. `/customers/$customerId?tab=`: the id is a path
 * param, the open section a search param, so a customer's invoices or wallet is
 * a link. Overview is the default and stays out of the address bar.
 */
const customerDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/$customerId',
  // The Activity tab's filters ride along (`activitySearch.ts`), so a reload
  // or a shared link opens the same trail.
  validateSearch: (search: Record<string, unknown>): { tab: CustomerTab } & ActivitySearch => {
    const tab = parseCustomerTab(search['tab'])
    return { tab, ...(tab === 'activity' ? parseActivitySearch(search) : {}) }
  },
  search: { middlewares: [stripSearchParams({ tab: 'overview' })] },
  component: CustomerDetailRouteComponent,
})

function CustomerDetailRouteComponent() {
  const { customerId } = customerDetailRoute.useParams()
  const { tab, ...activitySearch } = customerDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <CustomerDetailPage
      customerId={customerId}
      tab={tab}
      activitySearch={activitySearch}
      onActivitySearchChange={(next) =>
        void navigate({
          to: '/customers/$customerId',
          params: { customerId },
          search: { tab: 'activity', ...next },
          replace: true,
        })
      }
      onTabChange={(next) =>
        void navigate({
          to: '/customers/$customerId',
          params: { customerId },
          search: { tab: next },
          replace: true,
        })
      }
      onNavigateToList={() => void navigate({ to: '/customers', search: {} as never })}
      onEdit={(id) =>
        void navigate({ to: '/customers/$customerId/edit', params: { customerId: id } })
      }
    />
  )
}

const subscriptionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/contracts',
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
      onQueryChange={(next) => void navigate({ to: '/contracts', search: next, replace: true })}
      onCreate={() => void navigate({ to: '/contracts/new', search: {} as never })}
      onOpen={(subscriptionId) =>
        void navigate({
          to: '/contracts/$subscriptionId',
          params: { subscriptionId },
          search: {} as never,
        })
      }
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
      onOpenPlan={(planId) =>
        void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
      }
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
      onCreate={() => void navigate({ to: '/payments/new' })}
      onPaymentClick={(payment) =>
        void navigate({ to: '/payments/$paymentId', params: { paymentId: payment.id } })
      }
      onQueryChange={(next) => void navigate({ to: '/payments', search: next, replace: true })}
    />
  )
}

const paymentCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/payments/new',
  // `?invoice=` preselects the invoice, from an invoice's "Record payment".
  validateSearch: (search: Record<string, unknown>): { invoice?: string } =>
    typeof search['invoice'] === 'string' && search['invoice']
      ? { invoice: search['invoice'] }
      : {},
  component: PaymentCreateRouteComponent,
})

function PaymentCreateRouteComponent() {
  const navigate = useNavigate()
  const { invoice } = paymentCreateRoute.useSearch()
  const toList = () => void navigate({ to: '/payments', search: {} as never })
  return (
    <PaymentFormPage
      {...(invoice ? { invoiceId: invoice } : {})}
      onCancel={toList}
      onDone={(paymentId) =>
        void navigate(
          paymentId
            ? { to: '/payments/$paymentId', params: { paymentId } }
            : { to: '/payments', search: {} as never },
        )
      }
    />
  )
}

const paymentDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/payments/$paymentId',
  component: PaymentDetailRouteComponent,
})

function PaymentDetailRouteComponent() {
  const { paymentId } = paymentDetailRoute.useParams()
  const navigate = useNavigate()
  return (
    <PaymentDetailPage
      paymentId={paymentId}
      onBack={() => void navigate({ to: '/payments', search: {} as never })}
      onOpenInvoice={(invoiceId) =>
        void navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
      }
    />
  )
}

const creditNotesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/credit-memos',
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
      onCreate={() => void navigate({ to: '/credit-memos/new' })}
      onCreditNoteClick={(note) =>
        void navigate({ to: '/credit-memos/$creditNoteId', params: { creditNoteId: note.id } })
      }
      onQueryChange={(next) => void navigate({ to: '/credit-memos', search: next, replace: true })}
    />
  )
}

const creditNoteCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/credit-memos/new',
  // `?invoice=` preselects the invoice to credit, from an invoice's "Issue credit memo".
  validateSearch: (search: Record<string, unknown>): { invoice?: string } =>
    typeof search['invoice'] === 'string' && search['invoice']
      ? { invoice: search['invoice'] }
      : {},
  component: CreditNoteCreateRouteComponent,
})

function CreditNoteCreateRouteComponent() {
  const navigate = useNavigate()
  const { invoice } = creditNoteCreateRoute.useSearch()
  const toList = () => void navigate({ to: '/credit-memos', search: {} as never })
  return (
    <CreditNoteFormPage
      {...(invoice ? { invoiceId: invoice } : {})}
      onCancel={toList}
      onDone={(creditNoteId) =>
        void navigate(
          creditNoteId
            ? { to: '/credit-memos/$creditNoteId', params: { creditNoteId } }
            : { to: '/credit-memos', search: {} as never },
        )
      }
    />
  )
}

const creditNoteDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/credit-memos/$creditNoteId',
  component: CreditNoteDetailRouteComponent,
})

function CreditNoteDetailRouteComponent() {
  const { creditNoteId } = creditNoteDetailRoute.useParams()
  const navigate = useNavigate()
  return (
    <CreditNoteDetailPage
      creditNoteId={creditNoteId}
      onBack={() => void navigate({ to: '/credit-memos', search: {} as never })}
      onOpenInvoice={(invoiceId) =>
        void navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
      }
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
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
  validateSearch: (
    search: Record<string, unknown>,
  ): WorkflowQuery & { workflow?: string; run?: string } => {
    const open = parseOpenWorkflowRun(search)
    return {
      ...parseWorkflowSearch(search),
      ...(open ? { workflow: open.workflowId, run: open.runId } : {}),
    }
  },
  search: { middlewares: [stripSearchParams(DEFAULT_WORKFLOW_QUERY)] },
  component: WorkflowsRouteComponent,
})

function WorkflowsRouteComponent() {
  const { workflow, run, ...query } = useSearch({ from: workflowsRoute.id })
  const navigate = useNavigate()
  const openRun = workflow && run ? { workflowId: workflow, runId: run } : null

  return (
    <WorkflowListPage
      query={query}
      // Changing the list keeps whatever run is open; the list itself replaces history.
      onQueryChange={(next) =>
        void navigate({
          to: '/workflows',
          search: { ...next, ...(openRun ? { workflow, run } : {}) },
          replace: true,
        })
      }
      openRun={openRun}
      // Opening a run is a new history entry, so Back closes it.
      onOpenRunChange={(next) =>
        void navigate({
          to: '/workflows',
          search: next ? { ...query, workflow: next.workflowId, run: next.runId } : query,
          replace: next === null,
        })
      }
    />
  )
}

const exportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/exports',
  validateSearch: (search: Record<string, unknown>): DataExportQuery =>
    parseDataExportSearch(search),
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
      onOpenS3={() => void navigate({ to: '/exports/s3' })}
      onOpenExport={(row) =>
        void navigate({
          to: '/exports/s3/$connectionId/$exportId',
          params: { connectionId: row.connectionId, exportId: row.id },
          search: {},
        })
      }
    />
  )
}

/**
 * Imports: usage events from a CSV file (V1's Bulk imports, `/customer-management/import-export`).
 * The open import is a search param, so it is a link.
 */
const importsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/imports',
  validateSearch: (search: Record<string, unknown>): EventImportQuery =>
    parseEventImportSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_EVENT_IMPORT_QUERY)] },
  component: function ImportsRouteComponent() {
    const query = useSearch({ from: importsRoute.id })
    const navigate = useNavigate()
    return (
      <EventImportsPage
        query={query}
        onQueryChange={(next) => void navigate({ to: '/imports', search: next, replace: true })}
      />
    )
  },
})

/** V1's S3 connections page (`/tools/exports/s3`). */
const s3ExportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/exports/s3',
  component: function S3ExportsRouteComponent() {
    const navigate = useNavigate()
    return (
      <S3ConnectionsPage
        onBack={() => void navigate({ to: '/exports', search: {} as never })}
        onOpen={(connection) =>
          void navigate({
            to: '/exports/s3/$connectionId',
            params: { connectionId: connection.id },
            search: {} as never,
          })
        }
      />
    )
  },
})

/** One connection's exports (V1's `/tools/exports/s3/:connectionId/export`). */
const connectionExportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/exports/s3/$connectionId',
  validateSearch: (search: Record<string, unknown>): DataExportQuery =>
    parseDataExportSearch(search),
  search: { middlewares: [stripSearchParams(DEFAULT_DATA_EXPORT_QUERY)] },
  component: function ConnectionExportsRouteComponent() {
    const { connectionId } = connectionExportsRoute.useParams()
    const query = connectionExportsRoute.useSearch()
    const navigate = useNavigate()
    return (
      <ConnectionExportsPage
        connectionId={connectionId}
        query={query}
        onQueryChange={(next) =>
          void navigate({
            to: '/exports/s3/$connectionId',
            params: { connectionId },
            search: next,
            replace: true,
          })
        }
        onBack={() => void navigate({ to: '/exports/s3' })}
        onBackToExports={() => void navigate({ to: '/exports', search: {} as never })}
        onOpenExport={(row) =>
          void navigate({
            to: '/exports/s3/$connectionId/$exportId',
            params: { connectionId, exportId: row.id },
            search: {},
          })
        }
      />
    )
  },
})

/** One export (V1's `/tools/exports/s3/:connectionId/export/:exportId`). */
const dataExportRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/exports/s3/$connectionId/$exportId',
  validateSearch: (search: Record<string, unknown>): { tab?: 'runs' } =>
    search['tab'] === 'runs' ? { tab: 'runs' } : {},
  component: function DataExportRouteComponent() {
    const { connectionId, exportId } = dataExportRoute.useParams()
    const { tab } = dataExportRoute.useSearch()
    const navigate = useNavigate()
    const toConnection = () =>
      void navigate({
        to: '/exports/s3/$connectionId',
        params: { connectionId },
        search: {} as never,
      })
    return (
      <DataExportDetailPage
        connectionId={connectionId}
        exportId={exportId}
        tab={tab ?? 'overview'}
        onTabChange={(next) =>
          void navigate({
            to: '/exports/s3/$connectionId/$exportId',
            params: { connectionId, exportId },
            search: next === 'runs' ? { tab: 'runs' } : {},
            replace: true,
          })
        }
        onBackToExports={() => void navigate({ to: '/exports', search: {} as never })}
        onBackToS3={() => void navigate({ to: '/exports/s3' })}
        onBackToConnection={toConnection}
      />
    )
  },
})

const invoiceCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/invoices/new',
  // `?customer=` preselects the customer, from a customer's "Create invoice".
  validateSearch: (search: Record<string, unknown>): { customer?: string } =>
    typeof search['customer'] === 'string' && search['customer']
      ? { customer: search['customer'] }
      : {},
  component: InvoiceCreateRouteComponent,
})

function InvoiceCreateRouteComponent() {
  const navigate = useNavigate()
  const { customer } = invoiceCreateRoute.useSearch()
  const toList = () => void navigate({ to: '/invoices', search: {} as never })
  return (
    <InvoiceFormPage
      {...(customer ? { customerId: customer } : {})}
      onCancel={toList}
      onDone={(invoiceId) =>
        void navigate(
          invoiceId
            ? { to: '/invoices/$invoiceId', params: { invoiceId } }
            : { to: '/invoices', search: {} as never },
        )
      }
    />
  )
}

const invoiceEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/invoices/$invoiceId/edit',
  component: InvoiceEditRouteComponent,
})

function InvoiceEditRouteComponent() {
  const { invoiceId } = invoiceEditRoute.useParams()
  const navigate = useNavigate()
  const toDetail = (id: string = invoiceId) =>
    void navigate({ to: '/invoices/$invoiceId', params: { invoiceId: id } })
  // A finalized invoice whose lines changed comes back as a new draft: open that one.
  return <InvoiceEditPage invoiceId={invoiceId} onCancel={() => toDetail()} onDone={toDetail} />
}

const invoiceDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/invoices/$invoiceId',
  component: InvoiceDetailRouteComponent,
})

function InvoiceDetailRouteComponent() {
  const { invoiceId } = invoiceDetailRoute.useParams()
  const navigate = useNavigate()
  return (
    <InvoiceDetailPage
      invoiceId={invoiceId}
      onBack={() => void navigate({ to: '/invoices', search: {} as never })}
      onEdit={() => void navigate({ to: '/invoices/$invoiceId/edit', params: { invoiceId } })}
      onOpenCustomer={(customerId) =>
        void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
      }
    />
  )
}

const integrationsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/integrations',
  component: IntegrationListRouteComponent,
})

function IntegrationListRouteComponent() {
  const navigate = useNavigate()
  return (
    <IntegrationListPage
      onOpenProvider={(provider) =>
        void navigate({ to: '/integrations/$provider', params: { provider } })
      }
    />
  )
}

const integrationProviderRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/integrations/$provider',
  component: IntegrationProviderRouteComponent,
})

function IntegrationProviderRouteComponent() {
  const { provider } = integrationProviderRoute.useParams()
  const navigate = useNavigate()
  return (
    <ProviderConnectionsPage
      providerId={provider}
      onBack={() => void navigate({ to: '/integrations' })}
    />
  )
}

// The redirect URI QuickBooks and Zoho are registered with; the API config fixes the path.
const oauthCallbackRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/tools/integrations/oauth/callback',
  component: OAuthCallbackPage,
})

const pricingWidgetRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/pricing-widget',
  component: PricingWidgetRouteComponent,
})

function PricingWidgetRouteComponent() {
  const navigate = useNavigate()

  return (
    <PricingWidgetPage
      onViewPlan={(planId) =>
        void navigate({ to: '/plans/$planId', params: { planId }, search: {} as never })
      }
    />
  )
}

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
    <SettingsListFrame sectionId="taxes">
      <TaxListPage
        query={query}
        onQueryChange={(next) => void navigate({ to: '/taxes', search: next, replace: true })}
        onCreateTaxRate={() => void navigate({ to: '/taxes/new' })}
        onEditTaxRate={(taxRate) =>
          void navigate({ to: '/taxes/$taxRateId/edit', params: { taxRateId: taxRate.id } })
        }
        onOpenTaxRate={(taxRate) =>
          void navigate({ to: '/taxes/$taxRateId', params: { taxRateId: taxRate.id } })
        }
      />
    </SettingsListFrame>
  )
}

/** One tax rate: its details, edited in place, inside the Settings frame. */
const taxDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/taxes/$taxRateId',
  component: TaxDetailRouteComponent,
})

function TaxDetailRouteComponent() {
  const { taxRateId } = taxDetailRoute.useParams()
  const navigate = useNavigate()

  return (
    <SettingsListFrame sectionId="taxes">
      <TaxRateDetailPage
        taxRateId={taxRateId}
        onNavigateToList={() => void navigate({ to: '/taxes', search: {} as never })}
        onEdit={() => void navigate({ to: '/taxes/$taxRateId/edit', params: { taxRateId } })}
      />
    </SettingsListFrame>
  )
}

/** Tax rate create and edit are full pages. Both go back to the list. */
const taxCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/taxes/new',
  component: TaxCreateRouteComponent,
})

function TaxCreateRouteComponent() {
  const navigate = useNavigate()
  const toList = () => void navigate({ to: '/taxes', search: {} as never })

  return <TaxFormPage mode="create" onCancel={toList} onDone={toList} />
}

const taxEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/taxes/$taxRateId/edit',
  component: TaxEditRouteComponent,
})

function TaxEditRouteComponent() {
  const { taxRateId } = taxEditRoute.useParams()
  const navigate = useNavigate()
  const toList = () => void navigate({ to: '/taxes', search: {} as never })

  return <TaxFormPage mode="edit" taxRateId={taxRateId} onCancel={toList} onDone={toList} />
}

/** Billing entity create is a full page; detail sits inside the Settings frame. */
const billingEntityCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/billing-entities/new',
  validateSearch: (search: Record<string, unknown>): { step?: string } =>
    typeof search.step === 'string' ? { step: search.step } : {},
  component: BillingEntityCreateRouteComponent,
})

function BillingEntityCreateRouteComponent() {
  const navigate = useNavigate()
  const { step } = billingEntityCreateRoute.useSearch()

  return (
    <BillingEntityFormPage
      {...(step ? { step } : {})}
      onStepChange={(next) =>
        void navigate({
          to: '/settings/billing-entities/new',
          search: { step: next },
          replace: true,
        })
      }
      onCancel={() => void navigate({ to: '/settings', search: BILLING_ENTITIES_SECTION })}
      onDone={(entityId) =>
        void navigate({
          to: '/settings/billing-entities/$entityId',
          params: { entityId },
          search: {} as never,
        })
      }
    />
  )
}

const billingEntityDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/billing-entities/$entityId',
  validateSearch: (search: Record<string, unknown>): { tab: BillingEntityTab } => ({
    tab: parseBillingEntityTab(search['tab']),
  }),
  search: { middlewares: [stripSearchParams({ tab: 'details' })] },
  component: BillingEntityDetailRouteComponent,
})

function BillingEntityDetailRouteComponent() {
  const { entityId } = billingEntityDetailRoute.useParams()
  const { tab } = billingEntityDetailRoute.useSearch()
  const navigate = useNavigate()

  return (
    <SettingsListFrame sectionId="billing-entities">
      <BillingEntityDetailPage
        entityId={entityId}
        tab={tab}
        onTabChange={(next) =>
          void navigate({
            to: '/settings/billing-entities/$entityId',
            params: { entityId },
            search: { tab: next },
            replace: true,
          })
        }
        onBack={() => void navigate({ to: '/settings', search: BILLING_ENTITIES_SECTION })}
      />
    </SettingsListFrame>
  )
}

const BILLING_ENTITIES_SECTION = { section: 'billing-entities', tab: 'entities' } as const

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
      onOpenSubscription={(subscriptionId) =>
        void navigate({ to: '/contracts/$subscriptionId', params: { subscriptionId } })
      }
      onOpenFeature={(featureId) =>
        void navigate({ to: '/features/$featureId', params: { featureId } })
      }
      onOpenImports={() => void navigate({ to: '/imports', search: {} as never })}
    />
  )
}

/**
 * Settings, with both navigation levels in the address bar.
 *
 * The section rail and the tab strip inside it are each a search param, so a
 * link lands on the exact panel rather than one level short of it. `parseSettingsSearch`
 * is total and resolves the tab *against* the section, so a stale or
 * hand-edited pair (`?section=developers&tab=members`: two real ids that do
 * not go together) degrades to something coherent instead of rendering blank.
 *
 * `stripSearchParams` keeps the default pair out of the URL, so the address is
 * `/settings` rather than `/settings?section=organization&tab=profile`.
 */
const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  // API keys, service accounts and webhooks have their own Developer pages.
  // A moved section survives validation so the component can send it on;
  // parsing would otherwise rewrite it to the default section first.
  validateSearch: (search: Record<string, unknown>): SettingsQuery => {
    const raw = search['section']
    return typeof raw === 'string' && MOVED_SECTIONS[raw]
      ? ({ section: raw, tab: raw } as SettingsQuery)
      : parseSettingsSearch(search)
  },
  search: { middlewares: [stripSearchParams(DEFAULT_SETTINGS_QUERY)] },
  component: SettingsRouteComponent,
})

/** Discounts, Taxes and Cost tracking keep their routes but sit inside the Settings frame. */
function SettingsListFrame({ sectionId, children }: { sectionId: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <SettingsFrame
      sectionId={sectionId}
      onNavigate={(nextSection, nextTab) =>
        void navigate({
          to: '/settings',
          search: { section: nextSection, tab: nextTab },
        })
      }
      onOpenPage={(href) => void navigate({ to: href, search: {} as never })}
    >
      {children}
    </SettingsFrame>
  )
}

function SettingsRouteComponent() {
  const { section, tab } = useSearch({ from: settingsRoute.id })
  const navigate = useNavigate()
  const moved = MOVED_SECTIONS[section]
  if (moved) return <Navigate to={moved} search={{} as never} replace />

  return (
    <SettingsPage
      sectionId={section}
      tabId={tab}
      /*
       * One navigation for both ids. Changing section also changes tab: the
       * shell reports only the section, and the page picks that section's
       * first tab: and writing them separately would put an impossible pair
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
      onOpenPage={(href) => void navigate({ to: href, search: {} as never })}
    />
  )
}

/**
 * API keys and service accounts are Developer destinations, each a page of
 * its own; webhooks has its own routes below.
 */
const UsageBillingPage = lazy(() =>
  import('@/pages/selfBilling/UsageBillingPage').then((m) => ({ default: m.UsageBillingPage })),
)
const UpgradePage = lazy(() =>
  import('@/pages/selfBilling/UpgradePage').then((m) => ({ default: m.UpgradePage })),
)
const CheckoutReturnPage = lazy(() =>
  import('@/pages/selfBilling/CheckoutReturnPage').then((m) => ({
    default: m.CheckoutReturnPage,
  })),
)

/** Settings → Usage & billing: the tenant's own Flexprice account, inside the Settings frame. */
const usageBillingRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/usage-billing',
  component: function UsageBillingRouteComponent() {
    const navigate = useNavigate()
    return (
      <SettingsListFrame sectionId="usage-billing">
        <UsageBillingPage
          onUpgrade={() => void navigate({ to: '/settings/usage-billing/go-live' })}
        />
      </SettingsListFrame>
    )
  },
})

/** Upgrade: every Upgrade button lands here. A full canvas, without the Settings rail. */
const upgradeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/usage-billing/go-live',
  component: function UpgradeRouteComponent() {
    const navigate = useNavigate()
    return (
      <UpgradePage
        onBack={() => void navigate({ to: '/settings/usage-billing' })}
        onAlreadyPaid={() => void navigate({ to: '/billing/checkout/success' })}
      />
    )
  },
})

/** Where Stripe Checkout returns: the API's success and failure URLs. */
function CheckoutReturnRoute({ returnedBy }: { returnedBy: 'success' | 'failure' }) {
  const navigate = useNavigate()
  const environments = useEnvironments()
  const openProduction = (to: string) => {
    const production = environments.environments.find((e) => e.kind === 'production')
    if (production) environments.select(production.id)
    void navigate({ to, search: {} as never })
  }
  return (
    <CheckoutReturnPage
      returnedBy={returnedBy}
      onBilling={() => void navigate({ to: '/settings/usage-billing' })}
      onUpgrade={() => void navigate({ to: '/settings/usage-billing/go-live' })}
      onOpenProduction={() => openProduction('/')}
      onNextStep={(step) => {
        if (step === 'api-key') openProduction('/api-keys')
        else if (step === 'plans') openProduction('/plans')
        else window.open(DOCS_URL, '_blank', 'noopener,noreferrer')
      }}
    />
  )
}

const checkoutSuccessRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/billing/checkout/success',
  component: () => <CheckoutReturnRoute returnedBy="success" />,
})

const checkoutFailureRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/billing/checkout/failure',
  component: () => <CheckoutReturnRoute returnedBy="failure" />,
})

/** The return pages' parent, reached only by trimming the URL: back to Usage & billing. */
const checkoutRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/billing/checkout',
  component: () => <Navigate to="/settings/usage-billing" replace />,
})

const DeveloperPanels = lazy(() =>
  import('@/pages/settings/DeveloperPanels').then((m) => ({ default: m.DeveloperPanels })),
)

const developerRedirects = (
  [
    ['/api-keys', 'api-keys'],
    ['/service-accounts', 'service-accounts'],
  ] as const
).map(([path, panel]) =>
  createRoute({
    getParentRoute: () => shellRoute,
    path,
    component: () => (
      <Suspense fallback={null}>
        <DeveloperPanels panel={panel} />
      </Suspense>
    ),
  }),
)

/**
 * Webhooks: the Svix consumer app portal (V1's `WebhookDashboard`), on three
 * routes: the hub (`?tab=` endpoints / catalog / logs / activity), add
 * endpoint, and one endpoint (`?tab=` overview / testing / advanced). `?msg=`
 * opens a message's sheet over either. The old Settings tab redirects here
 * (`MOVED_SECTIONS`).
 */
const webhooksRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/webhooks',
  validateSearch: (search: Record<string, unknown>): WebhookHubSearch =>
    parseWebhookHubSearch(search),
  search: { middlewares: [stripSearchParams({ tab: 'endpoints' })] },
  component: WebhooksRouteComponent,
})

function WebhooksRouteComponent() {
  const { tab, msg } = webhooksRoute.useSearch()
  const navigate = useNavigate()

  return (
    <WebhooksPage
      tab={tab}
      onTabChange={(next) =>
        void navigate({ to: '/webhooks', search: { tab: next }, replace: true })
      }
      messageId={msg}
      onMessageChange={(next) =>
        void navigate({ to: '/webhooks', search: { tab, ...(next ? { msg: next } : {}) } })
      }
      onOpenEndpoint={(endpointId) =>
        void navigate({ to: '/webhooks/$endpointId', params: { endpointId }, search: {} as never })
      }
      onCreate={() => void navigate({ to: '/webhooks/new' })}
    />
  )
}

const webhookCreateRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/webhooks/new',
  component: WebhookCreateRouteComponent,
})

function WebhookCreateRouteComponent() {
  const navigate = useNavigate()
  return (
    <WebhookEndpointCreatePage
      onCancel={() => void navigate({ to: '/webhooks', search: {} as never })}
      onCreated={(endpointId) =>
        void navigate({ to: '/webhooks/$endpointId', params: { endpointId }, search: {} as never })
      }
    />
  )
}

const webhookEndpointRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/webhooks/$endpointId',
  validateSearch: (search: Record<string, unknown>): WebhookEndpointSearch =>
    parseWebhookEndpointSearch(search),
  search: { middlewares: [stripSearchParams({ tab: 'overview' })] },
  component: WebhookEndpointRouteComponent,
})

function WebhookEndpointRouteComponent() {
  const { endpointId } = webhookEndpointRoute.useParams()
  const { tab, msg } = webhookEndpointRoute.useSearch()
  const navigate = useNavigate()

  return (
    <WebhookEndpointDetailPage
      endpointId={endpointId}
      tab={tab}
      onTabChange={(next) =>
        void navigate({
          to: '/webhooks/$endpointId',
          params: { endpointId },
          search: { tab: next },
          replace: true,
        })
      }
      messageId={msg}
      onMessageChange={(next) =>
        void navigate({
          to: '/webhooks/$endpointId',
          params: { endpointId },
          search: { tab, ...(next ? { msg: next } : {}) },
        })
      }
      onBack={() => void navigate({ to: '/webhooks', search: {} as never })}
    />
  )
}

/** Labels are Tags now, in Settings; the old path keeps working. */
const labelsRedirect = createRoute({
  getParentRoute: () => shellRoute,
  path: '/labels',
  beforeLoad: () => {
    throw redirect({ to: '/settings', search: { section: 'tags', tab: 'tags' } })
  },
})

/** Legacy bookmarks retain their detail path, filters, wizard step and fragment. */
const legacyRoutes = ['/subscriptions', '/credit-notes', '/products'].flatMap((path) =>
  [path, `${path}/$`].map((legacyPath) =>
    createRoute({
      getParentRoute: () => shellRoute,
      path: legacyPath,
      beforeLoad: ({ location }) => {
        const destination = legacyDestination(location.pathname)
        if (destination)
          throw redirect({
            href: `${destination}${location.searchStr}${location.hash ? `#${location.hash}` : ''}`,
            replace: true,
          })
      },
    }),
  ),
)

const customerContractRedirect = createRoute({
  getParentRoute: () => shellRoute,
  path: '/customers/$customerId/subscriptions/new',
  beforeLoad: ({ params, location }) => {
    throw redirect({
      to: '/customers/$customerId/contracts/new',
      params,
      search: location.search,
      replace: true,
    })
  },
})

export const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  signUpConfirmRoute,
  legacySignUpConfirmRoute,
  authCallbackRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  setPasswordRoute,
  legacyAuthRoute,
  onboardingRoute,
  shellRoute.addChildren([
    ...legacyRoutes,
    customerContractRedirect,
    homeRoute,
    reportsRoute,
    revenueRecognitionRoute,
    deferredRollforwardRoute,
    unbilledRollforwardRoute,
    revenueRedirectRoute,
    featuresRoute,
    featureCreateRoute,
    featureEditRoute,
    featureDetailRoute,
    plansRoute,
    planAiRoute,
    planCreateRoute,
    planEditRoute,
    planDetailRoute,
    addonsRoute,
    addonCreateRoute,
    addonDetailRoute,
    addonEditRoute,
    couponsRoute,
    couponCreateRoute,
    couponDetailRoute,
    couponEditRoute,
    priceUnitsRoute,
    priceUnitCreateRoute,
    priceUnitDetailRoute,
    groupsRoute,
    groupCreateRoute,
    groupDetailRoute,
    environmentCreateRoute,
    costSheetsRoute,
    costSheetCreateRoute,
    costSheetDetailRoute,
    costSheetEditRoute,
    customersRoute,
    customerCreateRoute,
    customerEditRoute,
    customerSubscriptionCreateRoute,
    customerDetailRoute,
    subscriptionsRoute,
    invoicesRoute,
    invoiceCreateRoute,
    invoiceEditRoute,
    invoiceDetailRoute,
    paymentsRoute,
    paymentCreateRoute,
    paymentDetailRoute,
    creditNotesRoute,
    creditNoteCreateRoute,
    creditNoteDetailRoute,
    workflowsRoute,
    exportsRoute,
    importsRoute,
    s3ExportsRoute,
    connectionExportsRoute,
    dataExportRoute,
    integrationsRoute,
    integrationProviderRoute,
    oauthCallbackRoute,
    pricingWidgetRoute,
    usageSyncsRoute,
    taxesRoute,
    taxDetailRoute,
    usageBillingRoute,
    upgradeRoute,
    checkoutSuccessRoute,
    checkoutFailureRoute,
    checkoutRoute,
    taxCreateRoute,
    taxEditRoute,
    billingEntityCreateRoute,
    billingEntityDetailRoute,
    eventsRoute,
    settingsRoute,
    subscriptionCreateRoute,
    subscriptionDetailRoute,
    ...developerRedirects,
    webhooksRoute,
    webhookCreateRoute,
    webhookEndpointRoute,
    labelsRedirect,
    ...placeholderRoutes,
  ]),
])

export const router = createRouter({
  routeTree,
  // Per-route boundaries inside the shell, so a broken page is not a blank console.
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
