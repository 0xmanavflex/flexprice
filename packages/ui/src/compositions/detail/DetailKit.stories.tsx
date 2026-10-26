import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LayersIcon, RepeatIcon, ZapIcon } from '@ui/icons'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Badge } from '@ui/components/reui/badge'
import {
  ChoiceCards,
  Composer,
  CopyId,
  DetailTabs,
  Dot,
  Properties,
  SegmentMeter,
  SimpleTable,
  SplitMeter,
  SummaryRow,
  TotalRow,
  TotalsList,
  type Choice,
} from './DetailKit'
import { Field } from '../forms/Field'
import { FormDialogBodyContext } from '../forms/formDialogContext'

/**
 * The shared grammar of every detail page. One section per export, each with
 * a playground; the stories below are named for the piece they exercise.
 */
const meta = {
  title: 'Building blocks/Detail pages/DetailKit',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta

/* ------------------------------------------------------------------ tabs */

interface TabsArgs {
  /** How many tabs (1-6). */
  count: number
  showCounts: boolean
  /** Give each tab its own panel; off for the reference style where the page renders the body. */
  withPanels: boolean
  onChange: (value: string) => void
}

const TAB_DEFS = [
  { value: 'overview', label: 'Overview' },
  { value: 'subscriptions', label: 'Subscriptions', count: 4 },
  { value: 'invoices', label: 'Invoices', count: 12 },
  { value: 'wallets', label: 'Wallets', count: 1 },
  { value: 'usage', label: 'Usage' },
  { value: 'settings', label: 'Settings' },
]

function TabsDemo({ count, showCounts, withPanels, onChange }: TabsArgs) {
  const [active, setActive] = useState('overview')
  const defs = TAB_DEFS.slice(0, Math.min(6, Math.max(1, count)))
  const value = defs.some((def) => def.value === active) ? active : (defs[0]?.value ?? '')
  return (
    <DetailTabs
      value={value}
      onValueChange={(next) => {
        setActive(next)
        onChange(next)
      }}
      tabs={defs.map((def) => ({
        value: def.value,
        label: def.label,
        ...(showCounts && def.count !== undefined ? { count: def.count } : {}),
        ...(withPanels
          ? { content: <p className="text-muted-foreground text-sm">{def.label} panel.</p> }
          : {}),
      }))}
    />
  )
}

/** Line tabs with optional counts and panels. */
export const TabsPlayground: StoryObj<TabsArgs> = {
  name: 'DetailTabs: Playground',
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    showCounts: { control: 'boolean' },
    withPanels: { control: 'boolean' },
    onChange: { control: false },
  },
  args: { count: 4, showCounts: true, withPanels: true, onChange: fn() },
  render: (args) => <TabsDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    await expect(args.onChange).toHaveBeenCalledWith('invoices')
    await waitFor(() =>
      expect(canvas.getByRole('tab', { name: /Invoices/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    await expect(canvas.getByText('Invoices panel.')).toBeVisible()
  },
}

/** Without panels the tabs only drive the page's own body, and the counts are hidden. */
export const TabsBare: StoryObj<TabsArgs> = {
  ...TabsPlayground,
  name: 'DetailTabs: no panels, no counts',
  args: { count: 5, showCounts: false, withPanels: false, onChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(5)
    await expect(canvas.queryByRole('tabpanel')).not.toBeInTheDocument()
  },
}

/* ------------------------------------------------------------ properties */

interface PropertiesArgs {
  /** How many label/value pairs (1-12). */
  count: number
  columns: 1 | 2 | 3 | 4
}

const PROPERTY_DEFS = [
  { label: 'Customer', value: 'Acme Corporation' },
  { label: 'Email', value: 'billing@acme.example' },
  { label: 'Currency', value: 'USD' },
  { label: 'Billing cycle', value: 'Monthly' },
  { label: 'Tax ID', value: 'DE 123 456 789' },
  { label: 'Country', value: 'Germany' },
  { label: 'Payment terms', value: 'Net 30' },
  { label: 'Created', value: 'Mar 12, 2026' },
  { label: 'Updated', value: 'Apr 2, 2026' },
  { label: 'Status', value: <Badge variant="success-light">Active</Badge> },
  { label: 'External ID', value: 'ext_8f2a91c0-4b7e-4d1a-9c33-0f5e2a7b61d4' },
  { label: 'Notes', value: 'Prefers invoices on the 1st of the month.' },
]

/** A responsive label/value grid; the column count only applies from the `sm` breakpoint up. */
export const PropertiesPlayground: StoryObj<PropertiesArgs> = {
  name: 'Properties: Playground',
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 12, step: 1 } },
    columns: { control: 'inline-radio', options: [1, 2, 3, 4] },
  },
  args: { count: 6, columns: 3 },
  render: ({ count, columns }) => (
    <Properties
      columns={columns}
      items={PROPERTY_DEFS.slice(0, Math.min(12, Math.max(1, count)))}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Customer')).toBeVisible()
    await expect(canvas.getByText('Acme Corporation')).toBeVisible()
  },
}

/** Twelve properties in four columns. */
export const PropertiesDense: StoryObj<PropertiesArgs> = {
  ...PropertiesPlayground,
  name: 'Properties: dense',
  args: { count: 12, columns: 4 },
}

/* ----------------------------------------------------------- summary row */

interface SummaryRowArgs {
  /** How many figures (1-6). */
  count: number
  showHints: boolean
}

const SUMMARY_DEFS = [
  { label: 'MRR', value: '$12,480.00', hint: '+4.2% vs last month' },
  { label: 'Subscriptions', value: '4', hint: '1 ending soon' },
  { label: 'Outstanding', value: '$1,230.50', hint: '2 open invoices' },
  { label: 'Credit balance', value: '$300.00', hint: 'Expires Dec 31' },
  { label: 'Open invoices', value: '2', hint: 'Oldest 18 days' },
  { label: 'Customer since', value: 'Mar 2024', hint: '2 years' },
]

/** Inline figures between two rules; 2 and 3 items get matching columns, the rest use four. */
export const SummaryRowPlayground: StoryObj<SummaryRowArgs> = {
  name: 'SummaryRow: Playground',
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    showHints: { control: 'boolean' },
  },
  args: { count: 4, showHints: true },
  render: ({ count, showHints }) => (
    <SummaryRow
      items={SUMMARY_DEFS.slice(0, Math.min(6, Math.max(1, count))).map((item) => ({
        label: item.label,
        value: item.value,
        ...(showHints ? { hint: item.hint } : {}),
      }))}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('MRR')).toBeVisible()
    await expect(canvas.getByText('+4.2% vs last month')).toBeVisible()
  },
}

/* ----------------------------------------------------------------- totals */

interface TotalsArgs {
  paid: boolean
}

/**
 * The money column under a document's lines. Every row is one size; "Total"
 * and "Amount due" are medium, and the figure the document is about is a step
 * larger. Invoice, credit memo, upcoming invoice and the composer all use it.
 */
export const TotalsListPlayground: StoryObj<TotalsArgs> = {
  name: 'TotalsList: Playground',
  argTypes: { paid: { control: 'boolean' } },
  args: { paid: true },
  render: ({ paid }) => (
    <TotalsList className="ml-auto">
      <TotalRow label="Subtotal" value="$283.50" />
      <TotalRow label="Discount" value="−$28.35" />
      <TotalRow label="Tax" value="$20.41" />
      <TotalRow label="Total" value="$275.56" emphasis="total" rule />
      {paid ? <TotalRow label="Paid" value="− $275.56" /> : null}
      <TotalRow label="Amount due" value={paid ? '$0.00' : '$275.56'} emphasis="due" />
    </TotalsList>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const subtotal = canvas.getByText('Subtotal')
    const due = canvas.getByText('Amount due')
    // One type size down the column; only the weight marks the totals.
    await expect(getComputedStyle(subtotal).fontSize).toBe(getComputedStyle(due).fontSize)
    await expect(Number(getComputedStyle(due).fontWeight)).toBeLessThanOrEqual(500)
  },
}

/* ----------------------------------------------------------- simple table */

interface InvoiceRow {
  id: string
  number: string
  customer: string
  status: 'Paid' | 'Open' | 'Overdue'
  amount: string
}

interface SimpleTableArgs {
  /** How many rows (0-40); 0 shows the empty copy. */
  rows: number
  clickable: boolean
  withActions: boolean
  highlightId: 'none' | 'inv_002'
  emptyText: string
  onRowClick: (row: InvoiceRow) => void
}

const CUSTOMERS = ['Acme Corporation', 'Globex', 'Initech', 'Umbrella', 'Hooli']
const STATUSES: InvoiceRow['status'][] = ['Paid', 'Open', 'Overdue']
const makeInvoices = (count: number): InvoiceRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `inv_${String(index + 1).padStart(3, '0')}`,
    number: `INV-${String(1001 + index)}`,
    customer: CUSTOMERS[index % CUSTOMERS.length] ?? 'Acme Corporation',
    status: STATUSES[index % STATUSES.length] ?? 'Paid',
    amount: `$${(120 + index * 37.5).toFixed(2)}`,
  }))

const STATUS_VARIANT = {
  Paid: 'success-light',
  Open: 'info-light',
  Overdue: 'destructive-light',
} as const

/** The list-page table look, sized for a section; clickable rows, a highlighted row, a row-actions column. */
export const SimpleTablePlayground: StoryObj<SimpleTableArgs> = {
  name: 'SimpleTable: Playground',
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 40, step: 1 } },
    clickable: { control: 'boolean' },
    withActions: { control: 'boolean' },
    highlightId: { control: 'inline-radio', options: ['none', 'inv_002'] },
    emptyText: { control: 'text' },
    onRowClick: { control: false },
  },
  args: {
    rows: 5,
    clickable: true,
    withActions: false,
    highlightId: 'none',
    emptyText: 'No invoices yet.',
    onRowClick: fn(),
  },
  render: ({ rows, clickable, withActions, highlightId, emptyText, onRowClick }) => (
    <SimpleTable<InvoiceRow>
      rows={makeInvoices(rows)}
      empty={emptyText}
      highlightId={highlightId === 'none' ? null : highlightId}
      {...(clickable ? { onRowClick } : {})}
      columns={[
        { key: 'number', header: 'Invoice', cell: (row) => row.number },
        { key: 'customer', header: 'Customer', cell: (row) => row.customer },
        {
          key: 'status',
          header: 'Status',
          cell: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>,
        },
        {
          key: 'amount',
          header: 'Amount',
          className: 'text-right tabular-nums',
          cell: (row) => row.amount,
        },
        ...(withActions
          ? [
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                cell: (row: InvoiceRow) => (
                  <Button size="sm" variant="ghost" aria-label={`Download ${row.number}`}>
                    Download
                  </Button>
                ),
              },
            ]
          : []),
      ]}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('row')).toHaveLength(6)
    await userEvent.click(canvas.getByText('INV-1002'))
    await expect(args.onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv_002' }))
  },
}

/** No rows: the `empty` copy replaces the table. */
export const SimpleTableEmpty: StoryObj<SimpleTableArgs> = {
  ...SimpleTablePlayground,
  name: 'SimpleTable: empty',
  args: { ...SimpleTablePlayground.args, rows: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No invoices yet.')).toBeVisible()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}

/** A row-actions column has no title; its header cell still gets a screen-reader name. */
export const SimpleTableWithActions: StoryObj<SimpleTableArgs> = {
  ...SimpleTablePlayground,
  name: 'SimpleTable: actions column and highlight',
  args: { ...SimpleTablePlayground.args, withActions: true, highlightId: 'inv_002' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Download INV-1002' })).toBeVisible()
  },
}

/** Forty rows: a long list stays in the section. */
export const SimpleTableLong: StoryObj<SimpleTableArgs> = {
  name: 'SimpleTable: 40 rows',
  argTypes: SimpleTablePlayground.argTypes ?? {},
  args: { ...SimpleTablePlayground.args, rows: 40 },
  ...(SimpleTablePlayground.render ? { render: SimpleTablePlayground.render } : {}),
}

/* ---------------------------------------------------------- choice cards */

type Cadence = 'fixed' | 'usage' | 'one_time'

interface ChoiceCardsArgs {
  /** Two or three options. */
  count: 2 | 3
  initial: Cadence
  label: string
  onChange: (value: Cadence) => void
}

const CHOICES: Choice<Cadence>[] = [
  {
    value: 'fixed',
    title: 'Fixed',
    description: 'A flat amount every billing period.',
    icon: <RepeatIcon aria-hidden />,
  },
  {
    value: 'usage',
    title: 'Usage-based',
    description: 'Billed on what the customer consumes.',
    icon: <ZapIcon aria-hidden />,
  },
  {
    value: 'one_time',
    title: 'One-time',
    description: 'Charged once, when the subscription starts.',
    icon: <LayersIcon aria-hidden />,
  },
]

function ChoiceCardsDemo({ count, initial, label, onChange }: ChoiceCardsArgs) {
  const [value, setValue] = useState<Cadence>(initial)
  const options = CHOICES.slice(0, count)
  const shown = options.some((choice) => choice.value === value) ? value : 'fixed'
  return (
    <ChoiceCards
      label={label}
      options={options}
      value={shown}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

/** Two or three cards as a radio group; the selected one is ringed. */
export const ChoiceCardsPlayground: StoryObj<ChoiceCardsArgs> = {
  name: 'ChoiceCards: Playground',
  argTypes: {
    count: { control: 'inline-radio', options: [2, 3] },
    initial: { control: 'select', options: ['fixed', 'usage', 'one_time'] },
    label: { control: 'text' },
    onChange: { control: false },
  },
  args: { count: 2, initial: 'fixed', label: 'Charge type', onChange: fn() },
  render: (args) => <ChoiceCardsDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radiogroup', { name: 'Charge type' })).toBeVisible()
    await expect(canvas.getByRole('radio', { name: /Fixed/ })).toBeChecked()
    await userEvent.click(canvas.getByRole('radio', { name: /Usage-based/ }))
    await expect(args.onChange).toHaveBeenCalledWith('usage')
    await waitFor(() => expect(canvas.getByRole('radio', { name: /Usage-based/ })).toBeChecked())
    await expect(canvas.getByRole('radio', { name: /Fixed/ })).not.toBeChecked()
  },
}

/** Three options lay out as three columns. */
export const ChoiceCardsThree: StoryObj<ChoiceCardsArgs> = {
  ...ChoiceCardsPlayground,
  name: 'ChoiceCards: three options',
  args: { count: 3, initial: 'one_time', label: 'Charge type', onChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('radio')).toHaveLength(3)
    await expect(canvas.getByRole('radio', { name: /One-time/ })).toBeChecked()
  },
}

/* -------------------------------------------------------------- composer */

interface ComposerArgs {
  title: string
  submitLabel: string
  hasCancel: boolean
  submitting: boolean
  disabled: boolean
  /** Render as if inside a FormDialog, which supplies the padding itself. */
  inDialog: boolean
  onSubmit: () => void
  onCancel: () => void
}

/** A create form's wrapper: title, body, then Cancel and the submit button. */
export const ComposerPlayground: StoryObj<ComposerArgs> = {
  name: 'Composer: Playground',
  argTypes: {
    title: { control: 'text' },
    submitLabel: { control: 'text' },
    hasCancel: { control: 'boolean' },
    submitting: { control: 'boolean' },
    disabled: { control: 'boolean' },
    inDialog: { control: 'boolean' },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
  args: {
    title: 'New charge',
    submitLabel: 'Add charge',
    hasCancel: true,
    submitting: false,
    disabled: false,
    inDialog: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
  render: ({
    title,
    submitLabel,
    hasCancel,
    submitting,
    disabled,
    inDialog,
    onSubmit,
    onCancel,
  }) => (
    <div className="max-w-xl rounded-xl border">
      <FormDialogBodyContext.Provider value={inDialog}>
        <Composer
          title={title}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          submitting={submitting}
          disabled={disabled}
          {...(hasCancel ? { onCancel } : {})}
        >
          <Field label="Name" required>
            {(p) => <Input {...p} />}
          </Field>
        </Composer>
      </FormDialogBodyContext.Provider>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /Name/ }), 'Seats')
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.onCancel).toHaveBeenCalledOnce()
  },
}

/** While submitting, the submit button is disabled so it cannot fire twice. */
export const ComposerSubmitting: StoryObj<ComposerArgs> = {
  ...ComposerPlayground,
  name: 'Composer: submitting',
  args: { ...ComposerPlayground.args, submitting: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Add charge' })).toBeDisabled()
  },
}

/** Without `onCancel` there is no Cancel button. */
export const ComposerWithoutCancel: StoryObj<ComposerArgs> = {
  ...ComposerPlayground,
  name: 'Composer: no cancel',
  args: { ...ComposerPlayground.args, hasCancel: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Cancel' })).toBeNull()
  },
}

/** Inside a dialog the form does not pad itself again. */
export const ComposerInDialog: StoryObj<ComposerArgs> = {
  ...ComposerPlayground,
  name: 'Composer: inside a dialog',
  args: { ...ComposerPlayground.args, inDialog: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('form')).not.toHaveClass('p-6')
  },
}

/* ---------------------------------------------------------- copy id, dot */

interface CopyIdArgs {
  value: string
  subtitle: string
}

/** The copy-ID chip and the muted dot used between subtitle facts. */
export const CopyIdAndDot: StoryObj<CopyIdArgs> = {
  name: 'CopyId and Dot: Playground',
  argTypes: { value: { control: 'text' }, subtitle: { control: 'text' } },
  args: { value: 'cus_01HZX3K8Q2', subtitle: 'Created 12 Mar 2026' },
  render: ({ value, subtitle }) => (
    <div className="flex flex-col items-start gap-4">
      <CopyId value={value} />
      <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
        <span>Active</span>
        <Dot />
        <span>{subtitle}</span>
        <Dot />
        <span>USD</span>
      </p>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: `Copy ID ${args.value}` })).toBeVisible()
    // The dot is decoration: hidden from assistive tech.
    await expect(canvasElement.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  },
}

/* ---------------------------------------------------------------- meters */

interface MetersArgs {
  used: number
  total: number
  /** Fill for the single-value meter, 0 to 1. */
  value: number
  segments: number
}

/** The pill meters: used versus available, and a single fill level. */
export const MetersPlayground: StoryObj<MetersArgs> = {
  name: 'SplitMeter and SegmentMeter: Playground',
  argTypes: {
    used: { control: { type: 'number', min: 0, max: 1000, step: 10 } },
    total: { control: { type: 'number', min: 1, max: 1000, step: 10 } },
    value: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    segments: { control: { type: 'number', min: 12, max: 96, step: 4 } },
  },
  args: { used: 640, total: 1000, value: 0.4, segments: 48 },
  render: ({ used, total, value, segments }) => (
    <div className="flex max-w-lg flex-col gap-8">
      <SplitMeter
        used={used}
        total={total}
        usedLabel={`${used} used`}
        availableLabel={`${Math.max(0, total - used)} available`}
        segments={segments}
      />
      <SegmentMeter value={value} segments={segments} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: /640 used 64%/ })).toBeVisible()
    await expect(canvas.getByRole('img', { name: '40%' })).toBeVisible()
  },
}
