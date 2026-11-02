import {
  formatMoney,
  type ContractJournal,
  type JournalEntry,
  type RevenueContract,
  type Rollforward,
  type RollforwardAccount,
  type RollforwardRow,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { CalendarIcon, SearchIcon, XIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { SimpleTable, OverviewTiles, type SimpleColumn } from '../../compositions/detail/DetailKit'
import { SubTabState } from '../../compositions/detail/SubTabState'
import { Section } from '../../compositions/layout/Section'
import { useDebouncedSearch } from '../../compositions/tables/useDebouncedSearch'
import { FilterSelect, type FilterOption } from '../home/DashboardHome'
import { EntityLink } from '../shared/cells'

export const AccountRollforwardProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/detail/DetailKit',
    'compositions/layout/Section',
    'primitives/sheet',
    'pages/home/DashboardHome',
  ],
  note: "Revenue › Deferred or Unbilled rollforward, after Tabs': one ended month's beginning, movements and ending, then per customer × subscription with a total row, each row opening its lines on the account in a sheet.",
})

type Movement = 'invoiced' | 'earned' | 'adjustments'

/** How each account reads, in Tabs' words: deferred grows with invoices, unbilled with earned revenue. */
const ACCOUNT: Record<
  RollforwardAccount,
  {
    title: string
    summary: string
    balance: string
    movements: Array<{ field: Movement; label: string; hint: string }>
    ending: string
  }
> = {
  deferred_revenue: {
    title: 'Deferred rollforward',
    summary: 'Revenue invoiced but not yet earned, and how it moved in the month.',
    balance: 'Deferred Revenue',
    movements: [
      {
        field: 'invoiced',
        label: '(+) Invoiced',
        hint: 'Billed to customers before performance obligations satisfied',
      },
      {
        field: 'earned',
        label: '(−) Earned',
        hint: 'Performance obligations satisfied, released to revenue',
      },
      { field: 'adjustments', label: '(+/−) Adjustments', hint: 'Credit notes and other' },
    ],
    ending: 'Beginning + Invoiced − Earned +/− Adjustments',
  },
  unbilled_receivable: {
    title: 'Unbilled rollforward',
    summary: 'Revenue earned but not yet invoiced, and how it moved in the month.',
    balance: 'Unbilled Receivables',
    movements: [
      {
        field: 'earned',
        label: '(+) Earned',
        hint: 'Performance obligations satisfied ahead of invoicing',
      },
      {
        field: 'invoiced',
        label: '(−) Invoiced',
        hint: 'Billed to customers, releasing the unbilled receivable',
      },
      { field: 'adjustments', label: '(+/−) Adjustments', hint: 'Credit notes and other' },
    ],
    ending: 'Beginning + Earned − Invoiced +/− Adjustments',
  },
}

/**
 * A line's rollforward category, as the report counts it: an offset reclasses unbilled into
 * deferred, so it is earned on deferred and invoiced on unbilled.
 */
const lineType = (account: RollforwardAccount, eventType: string) => {
  if (eventType === 'revenue_earned') return 'Earned'
  if (eventType === 'revenue_offset') return account === 'deferred_revenue' ? 'Earned' : 'Invoiced'
  if (eventType === 'invoice_finalized' || eventType === 'invoice_voided') return 'Invoiced'
  return 'Adjustment'
}

export interface AccountRollforwardProps {
  account: RollforwardAccount
  rollforward: Rollforward | undefined
  customerNames: Readonly<Record<string, string>>
  /** Contract id → contract, for its subscription and term. */
  contracts: Readonly<Record<string, RevenueContract>>
  isLoading: boolean
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  search: string
  onSearchChange: (search: string) => void
  /** An ended month, `YYYY-MM`. */
  period: string
  periodOptions: FilterOption[]
  onPeriodChange: (period: string) => void
  /** 1-based. */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onOpenCustomer?: ((customerId: string) => void) | undefined
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  /** The row whose lines the sheet shows; null when closed. */
  selected: RollforwardRow | null
  onSelect: (row: RollforwardRow | null) => void
  /** The selected row's lines on this account, in the period. */
  entries: ContractJournal | undefined
  entriesLoading: boolean
  entriesError?: string | null | undefined
  invoiceNumbers?: Readonly<Record<string, string>> | undefined
  onOpenInvoice?: ((invoiceId: string) => void) | undefined
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const shortId = (id: string) => `…${id.slice(-8)}`

/** "Apr 22, 2026 – Apr 21, 2027", the last day served; the API's end is exclusive. */
const termLabel = (contract: RevenueContract) => {
  const end = contract.termEnd
    ? dayFormat.format(new Date(contract.termEnd.getTime() - 86_400_000))
    : 'ongoing'
  return `${dayFormat.format(contract.termStart)} – ${end}`
}

/** A table row: a customer × contract, or the total of every row across pages. */
interface TableRow {
  key: string
  row: RollforwardRow
  isTotal: boolean
}

interface SheetLine {
  id: string
  entry: JournalEntry
  debit: string
  credit: string
}

/** A tile's subtitle; it wraps, where the tile would cut it to one line. */
function Hint({ text }: { text: string }) {
  return <span className="whitespace-normal">{text}</span>
}

export function AccountRollforward({
  account,
  rollforward,
  customerNames,
  contracts,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  period,
  periodOptions,
  onPeriodChange,
  page,
  pageSize,
  onPageChange,
  onOpenCustomer,
  onOpenSubscription,
  selected,
  onSelect,
  entries,
  entriesLoading,
  entriesError,
  invoiceNumbers = {},
  onOpenInvoice,
}: AccountRollforwardProps) {
  const copy = ACCOUNT[account]
  const searchBox = useDebouncedSearch(search, onSearchChange)
  const rows = rollforward?.rows ?? []
  const count = rollforward?.count ?? 0
  const first = (page - 1) * pageSize
  const totals = rollforward?.totals
  const customerName = (id: string | null) => (id ? (customerNames[id] ?? id) : '—')
  const tableRows: TableRow[] = [
    ...rows.map((row) => ({ key: `${row.customerId}/${row.contractId}`, row, isTotal: false })),
    ...(totals && rows.length > 0 ? [{ key: 'total', row: totals, isTotal: true }] : []),
  ]

  const subscriptionCell = (row: RollforwardRow) => {
    const contract = row.contractId ? contracts[row.contractId] : undefined
    if (!contract) return row.contractId ? shortId(row.contractId) : '—'
    const id = contract.subscriptionId
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        {id && onOpenSubscription ? (
          <EntityLink label={id} onOpen={() => onOpenSubscription(id)} />
        ) : (
          <span className="truncate">{id ?? shortId(contract.id)}</span>
        )}
        <span className="text-muted-foreground text-xs">{termLabel(contract)}</span>
      </span>
    )
  }

  const amountColumn = (
    field: keyof RollforwardRow & ('opening' | Movement | 'closing'),
    header: string,
  ) =>
    ({
      key: field,
      header,
      className: 'text-right tabular-nums',
      cell: ({ row, isTotal }) => (
        <span className={cn(isTotal && 'font-medium')}>{formatMoney(row[field])}</span>
      ),
    }) satisfies SimpleColumn<TableRow>

  const columns: SimpleColumn<TableRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: ({ row, isTotal }) => {
        if (isTotal) return <span className="font-medium">Total</span>
        return row.customerId && onOpenCustomer ? (
          <EntityLink
            label={customerName(row.customerId)}
            onOpen={() => onOpenCustomer(row.customerId as string)}
          />
        ) : (
          customerName(row.customerId)
        )
      },
    },
    {
      key: 'subscription',
      header: 'Contract',
      cell: ({ row, isTotal }) => (isTotal ? '' : subscriptionCell(row)),
    },
    amountColumn('opening', 'Beginning'),
    ...copy.movements.map((movement) =>
      amountColumn(movement.field, movement.label.replace(/^\([^)]*\) /, '')),
    ),
    amountColumn('closing', 'Ending'),
  ]

  const lines: SheetLine[] = (entries?.entries ?? []).flatMap((entry) =>
    entry.lines.map((line) => ({
      id: line.id,
      entry,
      debit: line.debit ? formatMoney(line.debit) : '—',
      credit: line.credit ? formatMoney(line.credit) : '—',
    })),
  )
  const lineColumns: SimpleColumn<SheetLine>[] = [
    { key: 'type', header: 'Type', cell: (line) => lineType(account, line.entry.eventType) },
    { key: 'date', header: 'Date', cell: (line) => dayFormat.format(line.entry.date) },
    {
      key: 'description',
      header: 'Description',
      cell: (line) => {
        if (line.entry.sourceType !== 'invoice') return ''
        const label = `Invoice: ${invoiceNumbers[line.entry.sourceId] || shortId(line.entry.sourceId)}`
        return onOpenInvoice ? (
          <EntityLink label={label} onOpen={() => onOpenInvoice(line.entry.sourceId)} />
        ) : (
          label
        )
      },
    },
    { key: 'debit', header: 'Debit', className: 'text-right tabular-nums', cell: (l) => l.debit },
    {
      key: 'credit',
      header: 'Credit',
      className: 'text-right tabular-nums',
      cell: (l) => l.credit,
    },
  ]
  const selectedContract = selected?.contractId ? contracts[selected.contractId] : undefined

  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground text-[13px]">{copy.summary}</p>
      </div>

      <div role="search" className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-64 max-w-full">
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search customer or contract"
            placeholder="Search customer or contract"
            value={searchBox.draft}
            onChange={(event) => searchBox.update(event.target.value)}
            onBlur={searchBox.commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchBox.commit()
            }}
          />
          {searchBox.draft.length > 0 ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                size="icon-xs"
                aria-label="Clear search"
                onClick={searchBox.clear}
              >
                <XIcon aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <FilterSelect
          filter={{
            label: 'Period',
            value: period,
            options: periodOptions,
            onChange: onPeriodChange,
            icon: <CalendarIcon aria-hidden className="size-3.5" />,
          }}
        />
      </div>

      {totals ? (
        <OverviewTiles
          variant="row"
          tiles={[
            {
              label: `Beginning ${copy.balance}`,
              value: formatMoney(totals.opening),
              detail: <Hint text="Prior period ending balance" />,
            },
            ...copy.movements.map((movement) => ({
              label: movement.label,
              value: formatMoney(totals[movement.field]),
              detail: <Hint text={movement.hint} />,
            })),
            {
              label: `(=) Ending ${copy.balance}`,
              value: formatMoney(totals.closing),
              detail: <Hint text={copy.ending} />,
            },
          ]}
        />
      ) : null}

      <Section
        table
        showTitle
        title="By customer and contract"
        {...(count > 0 ? { description: `${count} contracts · select a row for its lines` } : {})}
      >
        <SubTabState
          hasData={rows.length > 0}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          columns={7}
          loadingLabel="Loading the rollforward"
          empty={{
            scene: 'revenue',
            title: search
              ? 'No customer or contract matches this search'
              : 'Nothing moved this month',
            description: search
              ? 'Search by customer name or subscription ID, or clear the search.'
              : 'Contracts appear once their invoices and revenue post to the journal.',
          }}
        >
          <SimpleTable
            columns={columns}
            rows={tableRows}
            getRowId={(row) => row.key}
            onRowClick={(row) => (row.isTotal ? undefined : onSelect(row.row))}
            highlightId={selected ? `${selected.customerId}/${selected.contractId}` : null}
          />
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {count === 0
                ? ''
                : `${first + 1} – ${first + rows.length} of ${count} contracts · the total covers all`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={first + rows.length >= count || isLoading}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </SubTabState>
      </Section>

      <Sheet open={selected !== null} onOpenChange={(open) => (open ? undefined : onSelect(null))}>
        <SheetContent className="sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>{customerName(selected?.customerId ?? null)}</SheetTitle>
            <SheetDescription>
              {selectedContract?.subscriptionId ?? ''}
              {selectedContract ? ` · ${termLabel(selectedContract)}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <p className="text-muted-foreground text-[13px]">
              Lines on {copy.balance.toLowerCase()} only; each entry&apos;s other side is on the
              contract&apos;s Journal entries tab.
              {entries
                ? ` Debit ${formatMoney(entries.debits)} · credit ${formatMoney(entries.credits)}.`
                : ''}
            </p>
            {selectedContract?.subscriptionId && onOpenSubscription ? (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onOpenSubscription(selectedContract.subscriptionId as string)}
                >
                  Open contract
                </Button>
              </div>
            ) : null}
            <SubTabState
              hasData={lines.length > 0}
              isLoading={entriesLoading}
              error={entriesError}
              columns={5}
              loadingLabel="Loading lines"
              empty={{ scene: 'revenue', title: 'No lines on this account this month' }}
            >
              <SimpleTable columns={lineColumns} rows={lines} />
            </SubTabState>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
