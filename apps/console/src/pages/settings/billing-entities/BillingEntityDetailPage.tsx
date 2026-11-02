import { useBillingEntity, useUpdateBillingEntity } from '@fp/query'
import { BILLING_ENTITY_TABS, BillingEntityDetail, BillingEntityForm } from '@fp/ui/pages'
import type { BillingEntityTab } from '@fp/ui/pages'
import { detailGate } from '@/pages/shared/detailGate'
import { RequireBillingEntities } from './RequireBillingEntities'
import { BillingEntityIntegrationsPanel } from './BillingEntityIntegrationsPanel'
import { BillingEntityTaxPanel } from './BillingEntityTaxPanel'
import { useEntityInvoicePreview } from './useEntityInvoicePreview'

/** Turns whatever is in `?tab=` into a real tab, defaulting to Details. */
export function parseBillingEntityTab(value: unknown): BillingEntityTab {
  return typeof value === 'string' && (BILLING_ENTITY_TABS as readonly string[]).includes(value)
    ? (value as BillingEntityTab)
    : 'details'
}

export interface BillingEntityDetailPageProps {
  entityId: string
  tab: BillingEntityTab
  onTabChange: (tab: BillingEntityTab) => void
  onBack: () => void
}

/** A billing entity's detail page; the Details tab edits it in place. */
export function BillingEntityDetailPage({
  entityId,
  tab,
  onTabChange,
  onBack,
}: BillingEntityDetailPageProps) {
  const entity = useBillingEntity(entityId)
  const update = useUpdateBillingEntity()
  const preview = useEntityInvoicePreview()

  return (
    <RequireBillingEntities>
      {entity.data ? (
        <BillingEntityDetail
          entity={entity.data}
          tab={tab}
          onTabChange={onTabChange}
          onBack={onBack}
          taxes={<BillingEntityTaxPanel entityId={entity.data.id} />}
          integrations={<BillingEntityIntegrationsPanel entityId={entity.data.id} />}
          details={
            <BillingEntityForm
              key={entity.data.id}
              mode="edit"
              defaultValue={{
                name: entity.data.name,
                legalName: entity.data.legalName,
                invoiceNumberPrefix: entity.data.invoiceNumberPrefix,
                seller: entity.data.seller,
                taxIdentifiers: entity.data.taxIdentifiers,
              }}
              preview={preview}
              isSubmitting={update.isPending}
              // The API's refusal (a taken prefix, say) is a toast (MutationToasts).
              onSubmit={(draft) => update.mutate({ id: entity.data.id, draft })}
            />
          }
        />
      ) : (
        detailGate(entity, {
          noun: 'this billing entity',
          listName: 'billing entities',
          onBack,
        })
      )}
    </RequireBillingEntities>
  )
}
