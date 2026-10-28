import type { ReactNode } from 'react'
import type { BillingEntity } from '@fp/domain'
import { Building2Icon } from '@ui/icons'
import { DetailTabs } from '@ui/compositions/detail/DetailKit'
import { provenance } from '@ui/provenance'
import { EntityHeader } from '../../shared/EntityHeader'
import { Pill } from '../../shared/cells'

/**
 * A billing entity's detail page: an `EntityHeader` (name, legal name, ID
 * copy chip, "Default" for the default entity) over `DetailTabs`. Each tab's
 * body is a slot, so the page that owns the data decides what fills it;
 * Integrations shows only when its slot is given.
 */
export const BillingEntityDetailProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityHeader', 'compositions/detail-kit'],
  note: 'Billing entity detail: EntityHeader + line DetailTabs (Details, Taxes, Integrations) with slotted bodies.',
})

export type BillingEntityTab = 'details' | 'taxes' | 'integrations'

export const BILLING_ENTITY_TABS = [
  'details',
  'taxes',
  'integrations',
] as const satisfies readonly BillingEntityTab[]

export interface BillingEntityDetailProps {
  entity: BillingEntity
  tab: BillingEntityTab
  onTabChange: (tab: BillingEntityTab) => void
  /** Back to the billing entities list. */
  onBack: () => void
  details: ReactNode
  /** Omitted, the Taxes tab is not shown. */
  taxes?: ReactNode
  /** Omitted, the Integrations tab is not shown. */
  integrations?: ReactNode
}

export function BillingEntityDetail({
  entity,
  tab,
  onTabChange,
  onBack,
  details,
  taxes,
  integrations,
}: BillingEntityDetailProps) {
  const shownTab: BillingEntityTab =
    (tab === 'taxes' && taxes) || (tab === 'integrations' && integrations) ? tab : 'details'
  const body = shownTab === 'taxes' ? taxes : shownTab === 'integrations' ? integrations : details
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Billing entities', onClick: onBack }, { label: entity.name }]}
        icon={<Building2Icon aria-hidden className="size-4" />}
        title={entity.name}
        badges={
          <>
            {entity.isDefault ? <Pill size="sm">Default</Pill> : null}
            <span className="text-muted-foreground text-xs">{entity.legalName}</span>
          </>
        }
        id={entity.id}
      />
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] min-w-0 flex-col gap-6 px-6 pb-10">
        <DetailTabs
          value={shownTab}
          onValueChange={(next) => onTabChange(next as BillingEntityTab)}
          tabs={[
            { value: 'details', label: 'Details' },
            ...(taxes ? [{ value: 'taxes', label: 'Taxes' }] : []),
            ...(integrations ? [{ value: 'integrations', label: 'Integrations' }] : []),
          ]}
        />
        {body}
      </div>
    </div>
  )
}
