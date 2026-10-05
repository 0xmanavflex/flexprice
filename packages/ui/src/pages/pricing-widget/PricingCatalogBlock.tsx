import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import { FeatureType, PlanStatus, type Entitlement, type Plan as PlanRecord } from '@fp/domain'
import { CodeXmlIcon, CopyIcon, PlusIcon, ZapIcon } from 'lucide-react'
import { PlanTile } from '@ui/components/blocks/solution-billing-2/components/plan-tile'
import type { Plan } from '@ui/components/blocks/solution-billing-2/components/data'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Button } from '@ui/components/primitives/button'
import { ButtonGroup } from '@ui/components/primitives/button-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { EmptyState } from '@ui/compositions/EmptyState'

/**
 * The pricing widget: ReUI `solution-billing-2` plan tiles fed the real plan
 * catalogue, with the embed snippet beneath. The vendored `PlanTile` is
 * mounted as-is; `toTile` is the adapter.
 */
export interface PricingCatalogBlockProps {
  plans: PlanRecord[]
  entitlements: Entitlement[]
  /** True while the catalogue is still loading, so the empty state is not shown prematurely. */
  loading?: boolean
  onCreatePlan: () => void
  onEditPlan: (planId: string) => void
  /** Written into the embed snippet's `data-tenant`. */
  tenant?: string
}

type Interval = 'monthly' | 'annual'

function describe(e: Entitlement): string {
  switch (e.featureType) {
    case FeatureType.Metered:
      return e.usageLimit === null ? 'Unlimited' : e.usageLimit.toLocaleString()
    case FeatureType.Static:
      return e.staticValue ?? '—'
    case FeatureType.Boolean:
      return e.isEnabled ? 'Included' : 'Off'
    default:
      return 'Custom'
  }
}

function toTile(plan: PlanRecord, entitlements: Entitlement[]): Plan {
  const amount = Number((plan.headline?.amount ?? '').replace(/[^0-9.]/g, '')) || 0
  const yearly = /year|annual/i.test(plan.headline?.period ?? '')
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status === PlanStatus.Published ? 'active' : 'archived',
    isPublic: true,
    monthlyPrice: yearly ? Math.round(amount / 12) : amount,
    annualPrice: yearly ? amount : amount * 12,
    perSeat: false,
    entitlements: entitlements
      .filter((e) => e.entityId === plan.id)
      .map((e) => ({
        id: e.id,
        icon: <ZapIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />,
        label: e.featureName ?? 'Feature',
        value: describe(e),
      })),
    addOns: [],
  }
}

export function PricingCatalogBlock({
  plans,
  entitlements,
  loading = false,
  onCreatePlan,
  onEditPlan,
  tenant = 'your-tenant',
}: PricingCatalogBlockProps) {
  const [interval, setInterval] = useState<Interval>('monthly')
  const tiles = plans.map((plan) => toTile(plan, entitlements))
  const published = tiles.filter((tile) => tile.status === 'active').length

  const snippet = `<script src="https://js.flexprice.io/pricing.js" data-tenant="${tenant}" data-interval="${interval}"></script>`

  const copySnippet = () => {
    void navigator.clipboard?.writeText(snippet)
    toast.success('Embed code copied')
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ButtonGroup>
          <Button
            type="button"
            variant={interval === 'monthly' ? 'secondary' : 'outline'}
            aria-pressed={interval === 'monthly'}
            onClick={() => setInterval('monthly')}
          >
            Monthly
          </Button>
          <Button
            type="button"
            variant={interval === 'annual' ? 'secondary' : 'outline'}
            aria-pressed={interval === 'annual'}
            onClick={() => setInterval('annual')}
          >
            Annual
          </Button>
        </ButtonGroup>
        <Button type="button" variant="outline" onClick={onCreatePlan}>
          <PlusIcon aria-hidden="true" />
          Create plan
        </Button>
        <Button type="button" onClick={copySnippet}>
          <CodeXmlIcon aria-hidden="true" />
          Get embed code
        </Button>
      </div>

      {loading ? (
        <div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          aria-busy="true"
          aria-label="Loading plans"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <EmptyState
          title="No plans to show yet"
          description="Publish a plan and it appears here, ready to embed on your pricing page."
          action={
            <Button type="button" onClick={onCreatePlan}>
              Create plan
            </Button>
          }
        />
      ) : (
        <>
          <Alert>
            <CodeXmlIcon aria-hidden="true" />
            <AlertTitle>Pricing widget</AlertTitle>
            <AlertDescription>
              {published} published {published === 1 ? 'plan is' : 'plans are'} shown. Open a plan
              to change what the widget displays.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {tiles.map((tile) => (
              <PlanTile key={tile.id} plan={tile} onEdit={onEditPlan} />
            ))}
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <CopyIcon className="size-3.5" aria-hidden="true" />
            <code className="font-mono">{snippet}</code>
          </div>
        </>
      )}
      <Toaster />
    </div>
  )
}
