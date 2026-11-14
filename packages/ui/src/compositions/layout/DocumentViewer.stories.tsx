import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  DocumentViewer,
  type DocumentHighlight,
  type DocumentHighlightFilter,
} from './DocumentViewer'

/** A two-page PDF, written by hand so the story needs no fixture file. */
function samplePdf(): File {
  const page = (text: string) => `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    `<< /Length ${page('Master Services Agreement').length} >>\nstream\n${page('Master Services Agreement')}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    `<< /Length ${page('Order Form').length} >>\nstream\n${page('Order Form')}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new File([body], 'Sample MSA.pdf', { type: 'application/pdf' })
}

/*
 * One letter-size page as an SVG image, with text at known places, so the
 * highlights below line up with real words and the stories run without pdf.js.
 * Positions are in page points (612 × 792); boxes are fractions of the page.
 */
const W = 612
const H = 792
const LINES: [x: number, y: number, size: number, text: string][] = [
  [72, 90, 20, 'MASTER SERVICES AGREEMENT'],
  [72, 140, 12, 'Customer: Acme Analytics Private Limited'],
  [72, 162, 12, 'Billing email: finance@example.com'],
  [72, 210, 12, 'Subscription fee: USD 1,200 per month, billed monthly in'],
  [72, 228, 12, 'advance, including 10,000,000 events.'],
  [72, 276, 12, 'Payment terms: Net 45 from the invoice date.'],
  [72, 324, 12, 'Renewal: pricing may change after the initial term.'],
]
const PAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/>${LINES.map(
    ([x, y, size, text]) =>
      `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#111">${text}</text>`,
  ).join('')}</svg>`,
)}`
const SOURCE = { url: PAGE, mediaType: 'image/svg+xml' }

/** A box around characters `from`–`to` of a line, assuming ~0.55em per character. */
const box = (line: number, from: number, to: number) => {
  const [x, y, size] = LINES[line] ?? [0, 0, 12]
  const char = size * 0.55
  return {
    page: 1,
    left: (x + from * char) / W,
    top: (y - size) / H,
    width: ((to - from) * char) / W,
    height: (size * 1.25) / H,
  }
}

const HIGHLIGHTS: DocumentHighlight[] = [
  {
    id: 'customer.legal_name',
    label: 'Legal name',
    value: 'Acme Analytics Private Limited',
    tone: 'confident',
    boxes: [box(1, 10, 40)],
  },
  {
    id: 'customer.billing_email',
    label: 'Billing email',
    value: 'finance@example.com',
    tone: 'confident',
    boxes: [box(2, 15, 34)],
  },
  {
    id: 'charges[0].amount',
    label: 'Charge 1 · Amount',
    value: '1200',
    tone: 'confident',
    boxes: [box(3, 18, 27)],
  },
  {
    id: 'charges[0].billing_period',
    label: 'Charge 1 · Billing period',
    value: 'Monthly',
    tone: 'confident',
    boxes: [box(3, 41, 56)],
  },
  // Wraps onto the next line: two boxes, one term.
  {
    id: 'charges[0].included_quantity',
    label: 'Charge 1 · Included quantity',
    value: '10000000',
    tone: 'doubt',
    boxes: [box(4, 18, 37)],
  },
  // Overlaps the billing period: the term to check draws above.
  {
    id: 'charges[0].billing_timing',
    label: 'Charge 1 · Billing timing',
    value: 'Advance',
    tone: 'doubt',
    boxes: [box(3, 49, 59), box(4, 0, 7)],
  },
  {
    id: 'billing.payment_terms',
    label: 'Payment terms',
    value: 'Net 45',
    tone: 'confident',
    boxes: [box(5, 15, 21)],
  },
  {
    id: 'term.renewal_price_change',
    label: 'Renewal price change',
    value: 'Pricing may change after the initial term',
    tone: 'doubt',
    boxes: [box(6, 9, 51)],
  },
]

type Props = ComponentProps<typeof DocumentViewer>

/** Holds the selection and filter, as a page would. */
function Interactive(props: Props) {
  const [activeId, setActiveId] = useState(props.activeId ?? null)
  const [filter, setFilter] = useState<DocumentHighlightFilter>(props.filter ?? 'all')
  return (
    <DocumentViewer
      {...props}
      activeId={activeId}
      onSelect={(id) => {
        setActiveId(id)
        props.onSelect?.(id)
      }}
      filter={filter}
      onFilterChange={setFilter}
    />
  )
}

const meta = {
  title: 'Building blocks/Layout/DocumentViewer',
  component: DocumentViewer,
  render: (args) => <Interactive {...args} />,
  parameters: { layout: 'fullscreen' },
  args: {
    source: null,
    empty: <p className="text-muted-foreground m-auto text-sm">Nothing to show yet</p>,
  },
  decorators: [
    (Story) => (
      <div className="bg-muted/30 flex h-[48rem] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentViewer>

export default meta
type Story = StoryObj<typeof meta>

/** No document: after a reload in another browser, or before a file is chosen. */
export const Empty: Story = {}

/** An image is one sheet. No highlights yet. */
export const Image: Story = {
  args: { source: SOURCE },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Page 1 of 1')).toBeVisible()
  },
}

/** Being read: a scan line runs down the page, and the toolbar says so. */
export const Scanning: Story = {
  args: { source: SOURCE, scanning: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Flexprice AI is reading the pages')).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Document pages' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  },
}

/**
 * Read: green where Flexprice AI is confident, yellow and dashed where a person
 * should check. One term wraps onto two lines; one overlaps another.
 */
export const Highlights: Story = {
  args: { source: SOURCE, highlights: HIGHLIGHTS, onSelect: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Confident · 5')).toBeVisible()
    await expect(canvas.getByText('Needs review · 3')).toBeVisible()
    const mark = canvas.getByRole('button', { name: /^Payment terms · Net 45$/ })
    await userEvent.click(mark)
    await expect(args.onSelect).toHaveBeenCalledWith('billing.payment_terms')
    await expect(mark).toHaveAttribute('aria-pressed', 'true')
  },
}

/** Green only. */
export const ConfidentOnly: Story = {
  args: { source: SOURCE, highlights: HIGHLIGHTS.filter((h) => h.tone === 'confident') },
}

/** Yellow only. */
/**
 * Terms read from the same words: painted once, in side-by-side stretches, never
 * stacked. Clicking a shared stretch again moves to the next term on it.
 */
export const SharedWords: Story = {
  args: {
    source: SOURCE,
    highlights: [
      {
        id: 'billing.structure',
        label: 'Billing structure',
        value: 'Monthly subscription',
        tone: 'doubt',
        boxes: [box(3, 0, 59)],
      },
      {
        id: 'charges[0].amount',
        label: 'Charge 1 · Amount',
        value: '1200',
        tone: 'confident',
        boxes: [box(3, 18, 27)],
      },
      {
        id: 'charges[0].amount_period',
        label: 'Charge 1 · Amount period',
        value: 'Monthly',
        tone: 'confident',
        boxes: [box(3, 18, 37)],
      },
      {
        id: 'term.term_months',
        label: 'Term length',
        value: '12',
        tone: 'confident',
        boxes: [box(5, 15, 21)],
      },
      {
        id: 'term.renewal_term_months',
        label: 'Renewal term',
        value: '12',
        tone: 'confident',
        boxes: [box(5, 15, 21)],
      },
    ],
    onSelect: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const marks = [...canvasElement.querySelectorAll<HTMLElement>('[data-highlight-ids]')]
    // Side by side on each line: no stretch starts inside another.
    const spans = marks
      .map((m) => m.getBoundingClientRect())
      .sort((a, b) => a.top - b.top || a.left - b.left)
    for (let i = 1; i < spans.length; i++) {
      const [a, b] = [spans[i - 1]!, spans[i]!]
      if (Math.abs(a.top - b.top) < 4) await expect(b.left).toBeGreaterThanOrEqual(a.right - 0.5)
    }
    const shared = canvasElement.querySelector<HTMLElement>(
      '[data-highlight-ids="term.term_months term.renewal_term_months"]',
    )!
    await userEvent.click(shared)
    await expect(args.onSelect).toHaveBeenLastCalledWith('term.term_months')
    await userEvent.click(shared)
    await expect(args.onSelect).toHaveBeenLastCalledWith('term.renewal_term_months')
  },
}

export const NeedsReviewOnly: Story = {
  args: { source: SOURCE, highlights: HIGHLIGHTS.filter((h) => h.tone === 'doubt') },
}

/** A selected term: a stronger fill and a ring, brought into view. */
export const Active: Story = {
  args: { source: SOURCE, highlights: HIGHLIGHTS, activeId: 'charges[0].billing_timing' },
  play: async ({ canvasElement }) => {
    const mark = await within(canvasElement).findByRole('button', {
      name: /Billing timing · Advance · Needs review/,
    })
    await expect(mark).toHaveAttribute('aria-pressed', 'true')
  },
}

/** The filter set to "Needs review": confident marks are not drawn. */
export const FilteredToReview: Story = {
  args: { source: SOURCE, highlights: HIGHLIGHTS, filter: 'doubt' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('button', { name: 'Needs review', pressed: true }),
    ).toBeVisible()
    // Filtered-out terms are not drawn at all.
    const mark = (id: string) =>
      canvasElement.querySelector(`[data-highlight-ids~="${CSS.escape(id)}"]`)
    await expect(mark('customer.legal_name')).toBeNull()
    await expect(mark('term.renewal_price_change')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Off' }))
    await expect(mark('term.renewal_price_change')).toBeNull()
  },
}

/** A file that is not a PDF or an image shows `empty`. */
export const Unsupported: Story = {
  args: { source: { file: new File(['x'], 'notes.txt', { type: 'text/plain' }) } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Nothing to show yet')).toBeVisible()
  },
}

/*
 * The PDF stories are out of the automated run (`!test`): pdf.js starts a
 * worker and draws to canvas, and inside the full browser run it was starved
 * past the 10 s story timeout and slowed its neighbours into flaking, while
 * passing on its own. Check them here, and against a real contract at
 * `/contracts/upload`.
 */

/** A PDF, drawn page by page, with the rail of page miniatures. */
export const Pdf: Story = {
  tags: ['!test'],
  args: { source: { file: samplePdf() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Page 1 of 2', {}, { timeout: 10_000 })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

/** A term read from two pages: one highlight, a box on each. */
export const PdfTermAcrossPages: Story = {
  tags: ['!test'],
  args: {
    source: { file: samplePdf() },
    highlights: [
      {
        id: 'customer.legal_name',
        label: 'Document title',
        value: 'Master Services Agreement',
        tone: 'confident',
        boxes: [
          { page: 1, left: 72 / W, top: 56 / H, width: 250 / W, height: 24 / H },
          { page: 2, left: 72 / W, top: 56 / H, width: 100 / W, height: 24 / H },
        ],
      },
    ],
  },
}

/** A PDF that cannot be opened shows `empty`. */
export const PdfLoadError: Story = {
  tags: ['!test'],
  args: { source: { file: new File(['not a pdf'], 'broken.pdf', { type: 'application/pdf' }) } },
}

/** Scanning a multi-page PDF: the line runs down each page and miniature in turn. */
export const PdfScanning: Story = {
  tags: ['!test'],
  args: { source: { file: samplePdf() }, scanning: true },
}
