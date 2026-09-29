import { useNavigate } from '@tanstack/react-router'
import { RevenueDashboard } from '@fp/ui/flexprice'
import { PageBody, PageHeader } from '@fp/ui/compositions'

/**
 * Revenue.
 *
 * A report page, not a list: `PageHeader` for the title and `PageBody` for the
 * scrolling, centred content region, with `RevenueDashboard` — the surface — in
 * between. The dashboard takes only a navigate callback; its data is its own
 * (sample, pending the revenue queries), so what it renders is testable without
 * this route.
 */
export function RevenuePage() {
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Recognised revenue, billed and unbilled, and the margin behind it."
      />
      <PageBody>
        <RevenueDashboard onNavigate={(path) => void navigate({ to: path, search: {} as never })} />
      </PageBody>
    </>
  )
}
