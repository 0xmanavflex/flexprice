import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import type { InvoiceQuery } from '@fp/domain'
import { InvoiceListPage } from '@/pages/invoices/InvoiceListPage'
import { parseInvoiceSearch, toInvoiceSearch } from './searchParams'
import { useState } from 'react'
import type { PriceOverride } from '@fp/domain'
import { SubscriptionCreatePage } from '@/pages/subscriptions/SubscriptionCreatePage'
import { type SubscriptionStepId, furthestOf, parseStep, toStepSearch } from './subscriptionSteps'
import type { FeatureQuery } from '@fp/domain'
import { FeatureListPage } from '@/pages/features/FeatureListPage'
import { FeatureCreatePage } from '@/pages/features/FeatureCreatePage'
import { parseFeatureSearch, toFeatureSearch } from './featureSearch'

const rootRoute = createRootRoute({ component: Outlet })

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
          search: toInvoiceSearch(next) as never,
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
  component: FeaturesRouteComponent,
})

function FeaturesRouteComponent() {
  const query = useSearch({ from: featuresRoute.id })
  const navigate = useNavigate()

  return (
    <FeatureListPage
      query={query}
      onQueryChange={(next) =>
        void navigate({ to: '/features', search: toFeatureSearch(next) as never, replace: true })
      }
      onCreate={() => void navigate({ to: '/features/new' })}
      onOpenFeature={(feature) =>
        void navigate({ to: '/features', search: { q: feature.name } as never })
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
