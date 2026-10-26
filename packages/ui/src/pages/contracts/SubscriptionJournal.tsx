import {
  JOURNAL_EVENT_LABEL,
  LEDGER_ACCOUNT_LABEL,
  formatMoney,
  type ContractJournal,
  type JournalEntry,
  type JournalLine,
} from '@fp/domain'
import { provenance } from '@ui/provenance'
import { SubTabState } from '../../compositions/detail/SubTabState'
import { Section } from '../../compositions/layout/Section'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { EntityLink } from '../shared/cells'

export const SubscriptionJournalProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/detail/SubTabState',
    'pages/shared/DetailTable',
  ],
  note: "A contract's Journal entries tab, after Tabs': one row per entry with its lines stacked, filterable by type and account pair.",
})

export interface SubscriptionJournalProps {
  journal: ContractJournal | undefined
  isLoading: boolean
  /** The sentence for a failed load. */
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  /** POB id → name, for the POB column and revenue descriptions. */
  obligationNames?: Readonly<Record<string, string>> | undefined
  /** Invoice id → number, for invoice descriptions. */
  invoiceNumbers?: Readonly<Record<string, string>> | undefined
  onOpenInvoice?: ((invoiceId: string) => void) | undefined
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const shortId = (id: string) => `…${id.slice(-8)}`
const eventLabel = (entry: JournalEntry) => JOURNAL_EVENT_LABEL[entry.eventType] ?? entry.eventType
const accountLabel = (line: JournalLine) => LEDGER_ACCOUNT_LABEL[line.account] ?? line.account

/** The accounts an entry moves, debits first, e.g. "Deferred revenue → Revenue". */
const accountPair = (entry: JournalEntry) => {
  const names = (side: 'debit' | 'credit') => [
    ...new Set(entry.lines.filter((line) => line[side]).map(accountLabel)),
  ]
  return `${names('debit').join(', ')} → ${names('credit').join(', ')}`
}

const SOURCE_LABEL: Record<string, string> = {
  credit_note: 'Credit note',
  payment: 'Payment',
  refund: 'Refund',
}

/** One value per line of the entry, stacked so the lines read as one entry. */
function Lines({ entry, value }: { entry: JournalEntry; value: (line: JournalLine) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {entry.lines.map((line) => (
        <span key={line.id} className="truncate">
          {value(line) || '\u00a0'}
        </span>
      ))}
    </div>
  )
}

export function SubscriptionJournal({
  journal,
  isLoading,
  error,
  onRetry,
  obligationNames = {},
  invoiceNumbers = {},
  onOpenInvoice,
}: SubscriptionJournalProps) {
  const pobName = (id: string | null) => (id ? (obligationNames[id] ?? shortId(id)) : '—')

  const description = (entry: JournalEntry) => {
    if (entry.sourceType === 'invoice') {
      const label = `Invoice: ${invoiceNumbers[entry.sourceId] || shortId(entry.sourceId)}`
      return onOpenInvoice ? (
        <EntityLink label={label} onOpen={() => onOpenInvoice(entry.sourceId)} />
      ) : (
        label
      )
    }
    if (entry.sourceType === 'pob') return pobName(entry.sourceId)
    return `${SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}: ${shortId(entry.sourceId)}`
  }

  const columns: DetailColumn<JournalEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      width: 120,
      className: 'align-top',
      cell: (entry) => dayFormat.format(entry.date),
      sortBy: (entry) => entry.date.getTime(),
    },
    {
      key: 'type',
      header: 'Type',
      width: 170,
      className: 'align-top',
      cell: eventLabel,
      sortBy: eventLabel,
      text: eventLabel,
    },
    {
      key: 'description',
      header: 'Description',
      width: 200,
      className: 'align-top',
      cell: description,
      text: (entry) => invoiceNumbers[entry.sourceId] ?? pobName(entry.sourceId),
    },
    {
      key: 'pob',
      header: 'POB',
      width: 200,
      cell: (entry) => (
        <Lines entry={entry} value={(line) => (line.pobId ? pobName(line.pobId) : '—')} />
      ),
      text: (entry) => entry.lines.map((line) => pobName(line.pobId)).join(' '),
    },
    {
      key: 'account',
      header: 'Account',
      width: 190,
      cell: (entry) => <Lines entry={entry} value={accountLabel} />,
      text: (entry) => entry.lines.map(accountLabel).join(' '),
    },
    {
      key: 'debit',
      header: 'Debited',
      width: 130,
      align: 'end',
      className: 'tabular-nums',
      cell: (entry) => (
        <Lines entry={entry} value={(line) => (line.debit ? formatMoney(line.debit) : '')} />
      ),
    },
    {
      key: 'credit',
      header: 'Credited',
      width: 130,
      align: 'end',
      className: 'tabular-nums',
      cell: (entry) => (
        <Lines entry={entry} value={(line) => (line.credit ? formatMoney(line.credit) : '')} />
      ),
    },
    {
      key: 'reversal',
      header: 'Reversal',
      width: 90,
      className: 'align-top',
      cell: (entry) => (entry.reversalOf ? shortId(entry.reversalOf) : '—'),
    },
  ]

  const entries = journal?.entries ?? []
  return (
    <Section
      table
      showTitle
      title="Journal entries"
      {...(journal && entries.length > 0
        ? {
            description: `${entries.length} entries · ${journal.lineCount} lines · debited ${formatMoney(journal.debits)} · credited ${formatMoney(journal.credits)}`,
          }
        : {})}
    >
      <SubTabState
        hasData={entries.length > 0}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        columns={columns.length}
        loadingLabel="Loading journal entries"
        empty={{
          scene: 'revenue',
          title: 'No journal entries yet',
          description:
            'Invoices post when they are finalized; revenue posts at each month end once recognition runs.',
        }}
      >
        <DetailTable
          compact
          label="Journal entries"
          noun="entries"
          rows={entries}
          columns={columns}
          pageSize={50}
          facets={[
            { id: 'type', label: 'Type', value: eventLabel },
            { id: 'accounts', label: 'Accounts', value: accountPair },
          ]}
        />
      </SubTabState>
    </Section>
  )
}
