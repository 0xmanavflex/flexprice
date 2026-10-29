import type { RevenueMonth, RevenueWaterfall } from '@fp/domain'
import type { ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import { Switch } from '@ui/components/primitives/switch'
import { TooltipProvider } from '@ui/components/primitives/tooltip'
import { CalendarIcon, SearchIcon, XIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { SimpleTable, type SimpleColumn } from '../../compositions/detail/DetailKit'
import { SubTabState } from '../../compositions/detail/SubTabState'
import { Section } from '../../compositions/layout/Section'
import { useDebouncedSearch } from '../../compositions/tables/useDebouncedSearch'
import { FilterSelect, type FilterOption } from '../home/DashboardHome'
import { EntityLink } from '../shared/cells'
import { RevenueAmount, amountOrDash, currentPeriod, monthLabel } from './RevenueAmount'

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export const RevenueRecognitionReportProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/detail/DetailKit',
    'primitives/input-group',
    'pages/home/DashboardHome',
    'primitives/switch',
  ],
  note: "Revenue › Revenue recognition, after Tabs': the revenue total over each month's label, customers × months below, month-end deferred and unbilled behind Details, and the current month tinted.",
})

export interface RevenueRecognitionReportProps {
  /** One page of customers; its totals cover every customer the search matches. */
  waterfall: RevenueWaterfall | undefined
  /** The last month-end recognized in the environment; null before the first run. */
  recognizedThrough?: Date | null | undefined
  /** Customer id → name; an id without a name shows as the id. */
  customerNames: Readonly<Record<string, string>>
  isLoading: boolean
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  search: string
  onSearchChange: (search: string) => void
  /** `YYYY-MM`, inclusive. */
  from: string
  to: string
  monthOptions: FilterOption[]
  onRangeChange: (range: { from: string; to: string }) => void
  details: boolean
  onDetailsChange: (details: boolean) => void
  /** 1-based. */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onOpenCustomer?: ((customerId: string) => void) | undefined
}

/**
 * The customer column stays put while the months scroll. A pinned cell must be opaque; the header's
 * gradient lays the band's muted/60 over the page background so it matches the rest of the band.
 * The divider is a pseudo-element: a cell border belongs to the table grid and scrolls away.
 */
const PINNED =
  'bg-background sticky left-0 z-10 after:bg-border after:absolute after:inset-y-0 after:right-0 after:w-px [th&]:bg-linear-to-r [th&]:from-muted/60 [th&]:to-muted/60'

interface CustomerRow {
  id: string
  months: Map<string, RevenueMonth>
}

/** Revenue, then month-end deferred and unbilled when Details is on. */
function Stack({ lines, details }: { lines: ReactNode[]; details: boolean }) {
  if (!details) return <>{lines[0]}</>
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, index) => (
        <span key={index} className={cn(index > 0 && 'text-muted-foreground text-xs')}>
          {line}
        </span>
      ))}
    </div>
  )
}

/** A header cell: the revenue total above the column's own label, as one band over the table. */
function TotalHeader({ total, label, end }: { total: ReactNode; label: string; end?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5 py-2', end && 'items-end')}>
      <span className="text-foreground text-sm font-medium tracking-normal normal-case tabular-nums">
        {total}
      </span>
      <span>{label}</span>
    </div>
  )
}

export function RevenueRecognitionReport({
  waterfall,
  recognizedThrough,
  customerNames,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  from,
  to,
  monthOptions,
  onRangeChange,
  details,
  onDetailsChange,
  page,
  pageSize,
  onPageChange,
  onOpenCustomer,
}: RevenueRecognitionReportProps) {
  const thisMonth = currentPeriod()
  const periods = waterfall?.periods ?? []
  const totalByPeriod = new Map((waterfall?.totals ?? []).map((m) => [m.period, m]))
  const rows: CustomerRow[] = (waterfall?.rows ?? []).map((row) => ({
    id: row.id,
    months: new Map(row.months.map((m) => [m.period, m])),
  }))
  const searchBox = useDebouncedSearch(search, onSearchChange)
  const count = waterfall?.count ?? 0
  const first = (page - 1) * pageSize

  const columns: SimpleColumn<CustomerRow>[] = [
    {
      key: 'customer',
      header: <TotalHeader total="Revenue total" label="Customer" />,
      className: PINNED,
      cell: (row) => {
        const name = customerNames[row.id] ?? row.id
        // A fixed width, so a long name truncates rather than widening the pinned column.
        return (
          <div className="w-48">
            <Stack
              details={details}
              lines={[
                onOpenCustomer ? (
                  <EntityLink label={name} onOpen={() => onOpenCustomer(row.id)} />
                ) : (
                  <span title={name} className="block truncate">
                    {name}
                  </span>
                ),
                'Deferred',
                'Unbilled',
              ]}
            />
          </div>
        )
      },
    },
    ...periods.map((period): SimpleColumn<CustomerRow> => ({
      key: period,
      header: (
        <div data-period={period}>
          <TotalHeader
            end
            total={<RevenueAmount month={totalByPeriod.get(period)} />}
            label={monthLabel(period)}
          />
        </div>
      ),
      className: cn('text-right tabular-nums', period === thisMonth && 'bg-primary/5'),
      cell: (row) => {
        const month = row.months.get(period)
        return (
          <Stack
            details={details}
            lines={[
              <RevenueAmount key="revenue" month={month} />,
              amountOrDash(month?.deferred),
              amountOrDash(month?.unbilled),
            ]}
          />
        )
      },
    })),
  ]

  const jumpToCurrent = () =>
    document
      .querySelector(`[data-period="${thisMonth}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })

  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium tracking-tight">Revenue recognition</h1>
        <p className="text-muted-foreground text-[13px]">
          Grey amounts are not posted yet: earned this month, or invoiced for later months. Hover a
          month for posted, pending and scheduled.
          {details ? ' Deferred and unbilled are month-end balances of ended months.' : ''}
        </p>
      </div>

      <div role="search" className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-64 max-w-full">
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search customers"
            placeholder="Search customers…"
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
            label: 'From',
            value: from,
            options: monthOptions,
            onChange: (next) => onRangeChange({ from: next, to }),
            icon: <CalendarIcon aria-hidden className="size-3.5" />,
          }}
        />
        <FilterSelect
          filter={{
            label: 'To',
            value: to,
            options: monthOptions,
            onChange: (next) => onRangeChange({ from, to: next }),
            icon: <CalendarIcon aria-hidden className="size-3.5" />,
          }}
        />
        <div className="ml-auto flex items-center gap-3">
          {recognizedThrough !== undefined ? (
            <span className="text-muted-foreground text-xs">
              {recognizedThrough
                ? `Recognized through ${dayFormat.format(recognizedThrough)}`
                : 'Not recognized yet'}
            </span>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={details} onCheckedChange={onDetailsChange} />
            Details
          </label>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={!periods.includes(thisMonth)}
            onClick={jumpToCurrent}
          >
            Jump to current
          </Button>
        </div>
      </div>

      <Section table title="Revenue by customer" showTitle={false}>
        <SubTabState
          hasData={rows.length > 0}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          columns={6}
          loadingLabel="Loading revenue"
          empty={{
            scene: 'revenue',
            title: search
              ? 'No customers match this search'
              : 'No recognized revenue in this range',
            description: search
              ? 'Try another name, or clear the search.'
              : 'Customers appear once their contracts are invoiced and revenue recognition is on.',
          }}
        >
          <TooltipProvider>
            <SimpleTable columns={columns} rows={rows} />
          </TooltipProvider>
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {count === 0 ? '' : `${first + 1} – ${first + rows.length} of ${count} customers`}
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
    </div>
  )
}
