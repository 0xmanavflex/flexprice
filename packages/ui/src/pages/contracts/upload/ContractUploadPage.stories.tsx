import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  type ContractExtractedTerm,
  type ContractTerm,
  type ContractType,
  type UploadedContract,
  collectContractHighlights,
} from '@fp/domain'
import type { DocumentHighlightFilter } from '@ui/compositions/layout/DocumentViewer'
import { PAGE_STORY_PARAMETERS } from '../../shared/shellFixtures'
import { ContractUploadPage, type ContractUploadState } from './ContractUploadPage'

/*
 * A one-page contract as an image (an SVG, so the words sit at known places
 * and the highlights line up), so the preview has something real in every run
 * without pdf.js. Positions are in page points, 612 × 792.
 */
const LINES: [y: number, text: string][] = [
  [90, 'MASTER SERVICES AGREEMENT'],
  [140, 'Customer: Acme Analytics Private Limited'],
  [188, 'Subscription fee: USD 1,200 per month, billed in advance.'],
  [236, 'Unit: cumulative billing across all workspaces.'],
  [284, 'Payment terms: Net 45 from the invoice date.'],
]
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792"><rect width="100%" height="100%" fill="white"/>${LINES.map(
  ([y, text], i) =>
    `<text x="72" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${i ? 12 : 20}" fill="#111">${text}</text>`,
).join('')}</svg>`
const FILE = new File([SVG], 'Acme MSA.png', { type: 'image/svg+xml' })

/** A term read from line `line`, characters `from`–`to` (about 0.55em each at 12pt). */
const term = (
  line: number,
  from: number,
  to: number,
  over: Partial<ContractTerm> = {},
): ContractTerm => {
  const y = LINES[line]?.[0] ?? 0
  return {
    value: 'value',
    confidence: 97,
    page: 1,
    quote: '',
    options: [],
    note: '',
    boxes: [
      {
        page: 1,
        left: (72 + from * 6.6) / 612,
        top: (y - 12) / 792,
        width: ((to - from) * 6.6) / 612,
        height: 15 / 792,
      },
    ],
    derived: false,
    ...over,
  }
}
const TERMS: ContractExtractedTerm[] = [
  {
    path: 'customer.legal_name',
    term: term(1, 10, 40, { value: 'Acme Analytics Private Limited' }),
  },
  { path: 'charges[0].amount', term: term(2, 18, 27, { value: '1200' }) },
  {
    path: 'charges[0].billing_timing',
    term: term(2, 47, 57, { value: 'advance', confidence: 93 }),
  },
  {
    path: 'charges[0].unit',
    term: term(3, 6, 24, { value: 'cumulative billing', confidence: 28 }),
  },
  { path: 'billing.payment_terms', term: term(4, 15, 21, { value: 'Net 45' }) },
  {
    path: 'billing.structure',
    term: term(2, 0, 16, { value: 'subscription fee', confidence: 55 }),
  },
]

const BASE: UploadedContract = {
  id: 'ctr_01',
  contractStatus: 'draft',
  document: { fileName: FILE.name, mediaType: 'image/png', sizeBytes: 482113 },
  extractionStatus: 'pending',
  extractionError: '',
  extraction: null,
}

const READ: UploadedContract = {
  ...BASE,
  extractionStatus: 'completed',
  extraction: {
    pages: 13,
    fields: 41,
    documents: [
      { type: 'msa', title: 'Master Services Agreement', pageStart: 1, pageEnd: 10 },
      { type: 'order_form', title: 'Order Form', pageStart: 11, pageEnd: 12 },
      { type: 'other', title: 'Data processing addendum', pageStart: 13, pageEnd: 13 },
    ],
    contractType: {
      value: 'new',
      confidence: 92,
      page: 1,
      quote: 'This Master Services Agreement is entered into',
      options: ['new', 'amendment', 'renewal'],
      note: '',
      boxes: [],
      derived: false,
    },
    toCheck: { total: 3, customer: 1, charges: 2, billing: 0 },
    terms: TERMS,
    doubts: ['The order form and the MSA give different notice periods.'],
  },
}

const FAILED: UploadedContract = {
  ...BASE,
  extractionStatus: 'failed',
  extractionError: 'The file has no readable text. Upload a text-based PDF or a clearer scan.',
}

type Args = Omit<ComponentProps<typeof ContractUploadPage>, 'contractType' | 'onContractTypeChange'>

function Story(args: Args) {
  const guess = args.contract?.extraction?.contractType?.value ?? null
  const [contractType, setContractType] = useState<ContractType | null>(guess)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocumentHighlightFilter>('all')
  const terms = args.contract?.extraction?.terms
  return (
    // Full window, as the route renders it: no sidebar.
    <div className="flex h-dvh flex-col">
      <ContractUploadPage
        {...args}
        contractType={contractType}
        onContractTypeChange={setContractType}
        highlights={terms ? collectContractHighlights(terms) : []}
        activeHighlightId={activeId}
        onHighlightSelect={setActiveId}
        highlightFilter={filter}
        onHighlightFilterChange={setFilter}
      />
    </div>
  )
}

const meta = {
  title: 'App/Contracts/Upload contract',
  component: Story,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    state: 'empty' as ContractUploadState,
    file: null,
    contract: null,
    onSelectFile: fn(),
    onReplace: fn(),
    onBack: fn(),
  },
  argTypes: {
    state: { control: 'select', options: ['empty', 'uploading', 'reading', 'read', 'failed'] },
  },
} satisfies Meta<typeof Story>

export default meta
type StoryT = StoryObj<typeof meta>

/** No file yet: the drop area, the backend's real limits, Continue disabled. */
export const Empty: StoryT = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('PDF, PNG or JPG · up to 20 MB')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Continue/ })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /Step 2 of 5: Customer/ })).toBeDisabled()
  },
}

/** The upload was refused: the backend's reason sits under the drop area. */
export const UploadRefused: StoryT = {
  args: { uploadError: 'Upload a PDF, PNG or JPG file' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent(
      'Upload a PDF, PNG or JPG file',
    )
  },
}

export const Uploading: StoryT = { args: { state: 'uploading', file: FILE } }

/** Stored; Flexprice AI is reading it. */
export const Reading: StoryT = {
  args: { state: 'reading', file: FILE, contract: BASE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Reading the contract')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Continue/ })).toBeDisabled()
  },
}

/** Polling gave up after five minutes with the extraction still running. */
export const StillWorking: StoryT = {
  args: { state: 'reading', file: FILE, contract: BASE, stillWorking: true },
}

/** Read: the documents in the file, and the contract type preselected from the guess. */
export const Read: StoryT = {
  args: { state: 'read', file: FILE, contract: READ, onContinue: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('41 terms from 13 pages · 3 to check')).toBeVisible()
    await expect(canvas.getByText('Master services agreement')).toBeVisible()
    await expect(canvas.getByText('Pages 1–10')).toBeVisible()
    await expect(canvas.getByText('Page 13')).toBeVisible()
    await expect(canvas.getByRole('radio', { name: /New contract/ })).toBeChecked()
    await expect(canvas.getByText('Flexprice AI’s guess')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Continue/ }))
    await expect(args.onContinue).toHaveBeenCalled()
  },
}

/** Read, but the next step does not exist yet: Continue stays disabled. */
export const ReadNoNextStep: StoryT = {
  args: { state: 'read', file: FILE, contract: READ },
}

/** After a reload only the contract is known; the preview pane says why it is empty. */
export const ReadAfterReload: StoryT = {
  args: { state: 'read', file: null, contract: READ },
}

export const Failed: StoryT = {
  args: { state: 'failed', file: FILE, contract: FAILED },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/no readable text/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Upload another file' }))
    await expect(args.onReplace).toHaveBeenCalled()
  },
}
