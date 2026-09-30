import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money } from '@fp/domain'
import {
  EmDash,
  FeatureTypePill,
  Pill,
  dateColumn,
  idColumn,
  moneyColumn,
  numberColumn,
  pillColumn,
  textColumn,
  type PillTone,
} from './cells'

/**
 * The cell vocabulary every list table is written in.
 *
 * Shown as a catalogue rather than inside a table on purpose: the point of
 * these is that they render the same wherever they are used, and a page that
 * needs a new kind of cell should be able to see at a glance that there is
 * already one for it.
 */
const meta = {
  title: 'Foundation/Flexprice/Cells',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const TONES: PillTone[] = ['neutral', 'success', 'info', 'warning', 'danger']

export const Pills: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {TONES.map((tone) => (
          <Pill key={tone} tone={tone}>
            {tone[0]!.toUpperCase() + tone.slice(1)}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FeatureTypePill type="metered" label="Metered" />
        <FeatureTypePill type="boolean" label="Boolean" />
        <FeatureTypePill type="static" label="Static" />
        <FeatureTypePill type="config" label="Config" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Success')).toBeInTheDocument()
    await expect(canvas.getByText('Metered')).toBeInTheDocument()

    // 24px, fully rounded — the one pill shape the whole console uses.
    const pill = canvas.getByText('Neutral').closest('span')
    await expect(pill).not.toBeNull()
    const box = (pill as HTMLElement).getBoundingClientRect()
    await expect(Math.round(box.height)).toBe(24)
  },
}

/** Nothing measured, nothing set, nothing yet — said out loud. */
export const Absent: Story = {
  render: () => <EmDash />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('—')).toBeInTheDocument()
  },
}

interface Row {
  id: string
  name: string
  lookup: string
  amount: ReturnType<typeof money>
  seats: number
  created: Date | null
}

const ROW: Row = {
  id: '01JF8Z3K7Q9W2E4R6T8Y0U1I2O',
  name: 'Enterprise onboarding',
  lookup: 'enterprise_onboarding',
  amount: money('1249.50', 'USD'),
  seats: 12500,
  created: new Date('2026-03-04T00:00:00Z'),
}

/**
 * Every helper, on one row.
 *
 * The assertions below are the contract eleven migrations depend on: a helper
 * renders a value, an em dash for an absent one, and a `text()` that is a
 * plain string — which is what Export CSV writes.
 */
export const ColumnHelpers: Story = {
  render: () => {
    const columns = [
      textColumn<Row>('name', 'Name', (row) => row.name),
      idColumn<Row>('id', 'Identifier', (row) => row.id),
      pillColumn<Row>('status', 'Status', () => ({ label: 'Published', tone: 'success' })),
      moneyColumn<Row>('amount', 'Amount', (row) => row.amount, { locale: 'en-US' }),
      numberColumn<Row>('seats', 'Seats', (row) => row.seats, { locale: 'en-US' }),
      dateColumn<Row>('created', 'Created', (row) => row.created, { locale: 'en-US' }),
      textColumn<Row>('missing', 'Never set', () => null),
    ]
    return (
      <dl className="grid max-w-md grid-cols-[10rem_1fr] items-center gap-y-3 text-sm">
        {columns.map((column) => (
          <div key={column.id} className="contents">
            <dt className="text-muted-foreground text-[11px] tracking-[0.08em] uppercase">
              {column.header}
            </dt>
            <dd className="min-w-0">{column.cell(ROW)}</dd>
          </div>
        ))}
      </dl>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Enterprise onboarding')).toBeInTheDocument()
    await expect(canvas.getByText('01JF8Z3K7Q9W2E4R6T8Y0U1I2O')).toBeInTheDocument()
    await expect(canvas.getByText('12,500')).toBeInTheDocument()
    await expect(canvas.getByText('Mar 4, 2026')).toBeInTheDocument()
    // An absent value is stated, never left blank.
    await expect(canvas.getByText('—')).toBeInTheDocument()

    // The CSV side of the contract: plain text, and empty for an absent value.
    expect(textColumn<Row>('name', 'Name', (row) => row.name).text?.(ROW)).toBe(
      'Enterprise onboarding',
    )
    expect(numberColumn<Row>('seats', 'Seats', (row) => row.seats, { locale: 'en-US' }).text?.(ROW)).toBe(
      '12,500',
    )
    expect(textColumn<Row>('missing', 'Never set', () => null).text?.(ROW)).toBe('')
  },
}

/**
 * A long identifier clips; it does not paint over the column beside it.
 *
 * This is a regression test for a real bug — an un-truncated ULID rendered
 * straight across its neighbour and made two cells unreadable.
 */
export const LongValuesClip: Story = {
  render: () => (
    <div className="grid w-[22rem] grid-cols-2 border">
      <div className="min-w-0 border-r p-4">
        {idColumn<Row>('id', 'Identifier', (row) => row.id).cell(ROW)}
      </div>
      <div className="min-w-0 p-4">{textColumn<Row>('name', 'Name', (row) => row.name).cell(ROW)}</div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const id = canvas.getByText('01JF8Z3K7Q9W2E4R6T8Y0U1I2O')
    // Clipped rather than overflowing, and the full value stays on the title.
    await expect(id.scrollWidth).toBeGreaterThan(id.clientWidth)
    await expect(id).toHaveAttribute('title', '01JF8Z3K7Q9W2E4R6T8Y0U1I2O')
  },
}
