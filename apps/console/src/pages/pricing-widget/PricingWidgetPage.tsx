import { PricingCatalogBlock } from '@fp/ui/pages'
import { PageBody, PageHeader } from '@fp/ui/compositions'

/** The ReUI `solution-billing-2` plan catalogue block, unmodified. */
export function PricingWidgetPage() {
  return (
    <>
      <PageHeader
        title="Pricing Widget"
        description="The plan catalogue your customers choose from."
      />
      <PageBody>
        <PricingCatalogBlock />
      </PageBody>
    </>
  )
}
