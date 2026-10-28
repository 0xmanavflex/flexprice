import { useMemo } from 'react'
import { PlusIcon } from '@ui/icons'
import { RBAC_ENTITY, type BillingEntity } from '@fp/domain'
import { WriteGate } from '@ui/compositions/access/Access'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList } from '../../shared/EntityList'
import {
  type EntityColumn,
  EntityCell,
  Pill,
  dateColumn,
  idColumn,
  textColumn,
} from '../../shared/cells'

export const BillingEntityGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Billing entity columns over the shared list table.',
})

export interface BillingEntityGridProps {
  rows: BillingEntity[]
  total: number
  page: number
  pageSize: number
  onPaginationChange: (page: number, pageSize: number) => void
  search: string
  onSearchChange: (value: string) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onOpen?: (entity: BillingEntity) => void
  /** The primary create action, top right. */
  onCreate?: () => void
}

export function BillingEntityGrid({
  rows,
  total,
  page,
  pageSize,
  onPaginationChange,
  search,
  onSearchChange,
  isLoading = false,
  error = null,
  onRetry,
  onOpen,
  onCreate,
}: BillingEntityGridProps) {
  const columns = useMemo<EntityColumn<BillingEntity>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        width: 240,
        hideable: false,
        cell: (row) => (
          <EntityCell
            name={row.name}
            sub={row.isDefault ? <Pill size="sm">Default</Pill> : undefined}
          />
        ),
        text: (row) => row.name,
      },
      textColumn<BillingEntity>('legalName', 'Legal name', (row) => row.legalName, { width: 240 }),
      idColumn<BillingEntity>('prefix', 'Invoice prefix', (row) => row.invoiceNumberPrefix, {
        width: 160,
      }),
      textColumn<BillingEntity>('country', 'Country', (row) => row.seller.address.country, {
        width: 120,
      }),
      dateColumn<BillingEntity>('created', 'Created', (row) => row.createdAt),
    ],
    [],
  )

  return (
    <EntityList<BillingEntity>
      label="Billing entities"
      noun="billing entities"
      rows={rows}
      total={total}
      columns={columns}
      getRowId={(row) => row.id}
      page={page}
      pageSize={pageSize}
      onPaginationChange={onPaginationChange}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search billing entities…"
      exportFileName="billing-entities"
      primaryAction={
        onCreate ? (
          <WriteGate entity={RBAC_ENTITY.Setting}>
            <Button onClick={onCreate}>
              <PlusIcon aria-hidden className="size-4" />
              New entity
            </Button>
          </WriteGate>
        ) : undefined
      }
      {...(onOpen ? { onRowClick: onOpen } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={search.length > 0}
      onClearFilters={() => onSearchChange('')}
      filteredEmptyTitle="No billing entities match this search"
      empty={{
        scene: 'settings',
        title: 'No billing entities yet',
        description: 'Billing entities are the legal sellers your invoices are issued from.',
      }}
    />
  )
}
