import { useMemo } from 'react'
import {
  BookOpenIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  PencilIcon,
  ReceiptIcon,
  Trash2Icon,
  UserIcon,
  PlusIcon,
} from '@ui/icons'
import {
  CUSTOMER_FILTERS,
  CUSTOMER_SORT_LABEL,
  CUSTOMER_STATUS_LABEL,
  type Customer,
  type CustomerQuery,
  CustomerSortField,
  CustomerStatus,
  DEFAULT_CUSTOMER_QUERY,
  isCustomerQueryFiltered,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'
import {
  type EntityColumn,
  EmDash,
  dateColumn,
  idColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from '../shared/cells'
import { CopyValue } from '../shared/CopyValue'
import { IntegrationChips } from './IntegrationMark'

/**
 * The customer list, on the shared `EntityList`.
 *
 * Migrated from a hand-assembled `DataGrid`. Everything that used to be here
 * and is not about customers: the `useTable` call, the `tableLayout`, the
 * toolbar, the footer, the fit-to-window state: now lives once in
 * `EntityList`. What is left is the part that is genuinely about a customer.
 *
 * ## The columns that are not here
 *
 * The redesign asks for Plan, MRR, Wallet balance and Subscriptions on this
 * table. None of them are shipped, and the reason is worth stating because it
 * will come up again every time someone reads the spec beside the screen.
 *
 * `Customer` carries no money and no relations: deliberately, and its own
 * docstring says so: *"no `plan`, `currency` or `payment method`: a customer
 * has none of those, they belong to its subscriptions and wallets."* The
 * search endpoint behind this list (`POST /customers/search`) returns exactly
 * that record. A plan, a wallet balance or a subscription count would each be
 * a join the list endpoint does not perform, and MRR is not a field anywhere
 * in the API: it cannot even be assembled, because `money.ts` forbids summing
 * amounts in the browser and calls a sum the API did not send "an API gap".
 *
 * So they are **omitted rather than dashed**. The rule this follows, which the
 * other four billing grids follow too:
 *
 *   an em dash means *this row has no value*;
 *   a column no row can ever fill is removed, not dashed.
 *
 * Four permanently-empty columns would not be honest restraint: they would be
 * four columns quietly asserting that these customers happen to have no plan
 * and no revenue, which is a different and much more damaging claim than "we
 * do not offer this yet". When the joined list view lands, they come back.
 */
export const CustomerGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Customer columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(CustomerSortField).map((value) => ({
  value,
  label: CUSTOMER_SORT_LABEL[value],
}))

/**
 * The three cards under the first-run empty state.
 *
 * Every URL was requested and returned 200. Worth re-checking whenever these
 * change: the docs site namespaces everything under `/docs/` or
 * `/api-reference/`, and a plausible-looking guess such as
 * `docs.flexprice.io/customers` simply 404s. A dead link in an empty state is
 * worse than no link, because the empty state is where someone has already
 * admitted they do not know what to do next.
 */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a customer is',
    description: 'The record you bill against, and how it ties back to your own system.',
    href: 'https://docs.flexprice.io/docs/customers/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Creating one over the API',
    description: 'The fields that matter, including the external id that keeps them in sync.',
    href: 'https://docs.flexprice.io/api-reference/customers/create-a-customer',
    icon: <UserIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Archiving a customer',
    description: 'What happens to their contracts and invoices when you do.',
    href: 'https://docs.flexprice.io/docs/customers/archive',
    icon: <ReceiptIcon aria-hidden className="size-4" />,
  },
]

export interface CustomerGridProps {
  customers: Customer[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: CustomerQuery
  onQueryChange: (query: CustomerQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onCustomerClick?: (customer: Customer) => void
  /** The primary create action; renders a "New customer" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the customer's editor. Left out of the menu when absent. */
  onEdit?: ((customer: Customer) => void) | undefined
  /** Row menu: delete. The page confirms before it runs. */
  onDelete?: ((customer: Customer) => void) | undefined
  /** Row menu: open the customer's portal in a new tab (V1's "Open Customer Portal"). */
  onOpenPortal?: ((customer: Customer) => void) | undefined
  /** Row menu: copy a link to the customer's portal. */
  onCopyPortalLink?: ((customer: Customer) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates. Supplied by the app, never read from a global. */
  locale?: string
  /** Contracts per customer id, when the page has counted them; absent customers show an em dash. */
  contractCounts?: Record<string, number>
}

export function CustomerGrid({
  customers,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCustomerClick,
  onCreate,
  onEdit,
  onDelete,
  onOpenPortal,
  onCopyPortalLink,
  onClearFilters,
  locale,
  contractCounts,
}: CustomerGridProps) {
  const columns = useMemo<EntityColumn<Customer>[]>(
    () => [
      textColumn<Customer>('name', 'Name', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: CustomerSortField.Name,
        // The column the list is *for*. Hiding it leaves a table of
        // attributes belonging to nobody.
        hideable: false,
      }),
      // Its own column rather than a subtitle under the name. Stacked, it was
      // unsortable, unexportable and clipped twice as often; beside the name
      // it is a value like any other: and it is the field support actually
      // searches by.
      textColumn<Customer>('email', 'Email', (row) => row.email, { width: 220 }),
      {
        ...idColumn<Customer>('externalId', 'External ID', (row) => row.externalId, { width: 170 }),
        cell: (row) =>
          row.externalId ? <CopyValue value={row.externalId} label="external ID" /> : <EmDash />,
      },
      {
        id: 'integrations',
        header: 'Integrations',
        width: 140,
        text: (row) =>
          row.integrations
            .map((integration) =>
              integration.providerEntityId
                ? `${integration.name} (${integration.providerEntityId})`
                : integration.name,
            )
            .join(', '),
        cell: (row) =>
          row.integrations.length === 0 ? (
            <EmDash />
          ) : (
            <IntegrationChips integrations={row.integrations} />
          ),
      },
      // The list endpoint returns no subscription count, so this reads from
      // `contractCounts` when the page has one and is an em dash otherwise:
      // never a zero that nobody counted.
      numberColumn<Customer>('contracts', 'Contracts', (row) => contractCounts?.[row.id], {
        width: 110,
        align: 'center',
        zeroAsDash: true,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Customer>('createdAt', 'Created on', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: CustomerSortField.CreatedAt,
        ...(locale ? { locale } : {}),
      }),
      // Optional columns: off by default, available from the column menu.
      // Status stays a filter above the table as well.
      pillColumn<Customer>(
        'status',
        'Status',
        (row) => ({
          label: CUSTOMER_STATUS_LABEL[row.status],
          tone: row.status === CustomerStatus.Published ? 'success' : 'neutral',
        }),
        { hiddenByDefault: true },
      ),
      // Uppercased because ISO 3166-1 alpha-2 is uppercase; the API is not
      // always consistent about sending it that way.
      textColumn<Customer>(
        'country',
        'Country',
        (row) => (row.addressCountry ? row.addressCountry.toUpperCase() : null),
        { width: 100, hiddenByDefault: true },
      ),
    ],
    [locale, contractCounts],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_CUSTOMER_QUERY.sortBy &&
    query.sortDirection === DEFAULT_CUSTOMER_QUERY.sortDirection

  const rowActions = (customer: Customer): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onCustomerClick) {
      actions.push({
        label: 'View customer',
        readOnly: true,
        icon: <UserIcon aria-hidden className="size-4" />,
        onSelect: () => onCustomerClick(customer),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit customer',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(customer),
      })
    }
    // The portal is keyed by external id: a customer without one has no portal to open.
    if (onOpenPortal && customer.externalId) {
      actions.push({
        label: 'Open customer portal',
        icon: <ExternalLinkIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenPortal(customer),
      })
    }
    if (onCopyPortalLink && customer.externalId) {
      actions.push({
        label: 'Copy portal link',
        icon: <LinkIcon aria-hidden className="size-4" />,
        onSelect: () => onCopyPortalLink(customer),
      })
    }
    actions.push({
      label: 'Copy customer ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(customer.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete customer',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onDelete(customer),
      })
    }
    return actions
  }

  return (
    <EntityList<Customer>
      label="Customers"
      noun="customers"
      rows={customers}
      total={total}
      columns={columns}
      getRowId={(customer) => customer.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search customers…"
      /*
       * Field-by-field filters (name, external ID, email, status, created),
       * applied by the search endpoint so the total and pages agree with them.
       */
      filter={granularFilter({
        specs: CUSTOMER_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({
            ...query,
            sortBy: sortBy as CustomerSortField,
            sortDirection,
            page: 1,
          }),
      }}
      rowActions={rowActions}
      exportFileName="customers"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden className="size-4" />
            New customer
          </Button>
        ) : undefined
      }
      {...(onCustomerClick ? { onRowClick: onCustomerClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={isCustomerQueryFiltered(query)}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No customers match these filters"
      empty={{
        scene: 'customers',
        title: 'Nobody to bill yet',
        description:
          'A customer is who an invoice is addressed to. Create one: or send your first event with a new external id and Flexprice will create it for you.',
        guides: GUIDES,
      }}
    />
  )
}
