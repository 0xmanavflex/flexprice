import { useMemo, useState } from 'react'
import { BillingEntityMode } from '@fp/domain'
import { useBillingEntities, useBillingEntityStatus, useEnableBillingEntities } from '@fp/query'
import { ConfirmDialog, useAccess } from '@fp/ui/compositions'
import { BillingEntitiesEnableCard, BillingEntityGrid } from '@fp/ui/pages'
import { useEnvironments } from '@/app/shell/useEnvironments'
import { Panel, PanelError, PanelLoading, WidePanel, toFailure } from './panelKit'

const NEW_ENTITY_HREF = '/settings/billing-entities/new'

/**
 * Billing entities for this environment: the offer to enable them, the wait
 * while they are enabled, then the entities themselves. The mode is per
 * environment and enabling is irreversible, so this section is the only
 * place entity UI shows before `enabled`.
 */
export function BillingEntitiesPanel({ onOpenPage }: { onOpenPage: (href: string) => void }) {
  const status = useBillingEntityStatus()
  const failure = toFailure(status.error, 'billing entities')

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void status.refetch()} />
      </Panel>
    )
  }
  if (status.data === undefined) return <PanelLoading rows={3} />
  if (status.data === BillingEntityMode.Enabled) {
    return <EntityList onCreate={() => onOpenPage(NEW_ENTITY_HREF)} />
  }
  return <EnableOffer mode={status.data} />
}

function EnableOffer({ mode }: { mode: BillingEntityMode }) {
  const { current } = useEnvironments()
  const { isSuperAdmin } = useAccess()
  const enable = useEnableBillingEntities()
  const [confirming, setConfirming] = useState(false)

  return (
    <Panel>
      <BillingEntitiesEnableCard
        environmentName={current.name}
        canEnable={isSuperAdmin}
        isEnabling={mode === BillingEntityMode.Enabling || enable.isSuccess}
        onEnable={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Enable billing entities in ${current.name}?`}
        description="This can't be turned off. Existing customers are assigned to the default billing entity."
        confirmLabel="Enable billing entities"
        pendingLabel="Enabling…"
        isPending={enable.isPending}
        onConfirm={() => enable.mutate(undefined, { onSettled: () => setConfirming(false) })}
      />
    </Panel>
  )
}

function EntityList({ onCreate }: { onCreate: () => void }) {
  const entities = useBillingEntities()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (entities.data ?? []).filter(
      (entity) =>
        !needle ||
        entity.name.toLowerCase().includes(needle) ||
        entity.legalName.toLowerCase().includes(needle) ||
        entity.invoiceNumberPrefix.toLowerCase().includes(needle),
    )
  }, [entities.data, search])
  const failure = toFailure(entities.error, 'billing entities')

  return (
    <WidePanel>
      <BillingEntityGrid
        rows={matching.slice((page - 1) * pageSize, page * pageSize)}
        total={matching.length}
        page={page}
        pageSize={pageSize}
        onPaginationChange={(nextPage, nextSize) => {
          setPage(nextPage)
          setPageSize(nextSize)
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        isLoading={entities.isPending}
        error={failure?.message ?? null}
        onRetry={() => void entities.refetch()}
        onCreate={onCreate}
      />
    </WidePanel>
  )
}
