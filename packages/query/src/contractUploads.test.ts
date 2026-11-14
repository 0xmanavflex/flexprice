import { describe, expect, it } from 'vitest'
import { collectContractHighlights, countContractTermsToCheck } from '@fp/domain'
import RESULT from './__fixtures__/contract-extraction-result.json' with { type: 'json' }
import { toUploadedContract, type ContractWire } from './contractUploads'
import { fromWire } from './wire'

/** The backend's JSON for a completed upload, trimmed to what step 1 reads. */
const COMPLETED = {
  id: 'ctr_1',
  contract_status: 'draft',
  document: {
    key: 'imports/ctr_1.pdf',
    file_name: 'Gobblecube MSA.pdf',
    media_type: 'application/pdf',
    size_bytes: 482113,
    sha256: 'abc',
  },
  extraction_status: 'completed',
  extraction: {
    model: 'm',
    job_id: 'job_1',
    usage: { pages: 13, fields: 41, duration_seconds: 17.2 },
    result: {
      documents: [
        { type: 'msa', title: 'Master Services Agreement', page_start: 1, page_end: 10 },
        { type: 'order_form', title: 'Order Form', page_start: 11, page_end: 12 },
        { type: 'appendix', title: 'Appendix', page_start: 13, page_end: 13 },
      ],
      contract_type: {
        value: 'new',
        confidence: 92,
        page: 1,
        quote: 'This Master Services Agreement',
        options: ['new', 'amendment', 'renewal'],
        note: '',
        boxes: [{ page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.02 }, { page: 1 }],
      },
      to_check: { total: 3, customer: 1, charges: 2, billing: 0 },
    },
  },
}

const read = (body: unknown) => toUploadedContract(fromWire<ContractWire>(body))

describe('toUploadedContract', () => {
  it('maps a completed extraction', () => {
    const contract = read(COMPLETED)
    expect(contract.extractionStatus).toBe('completed')
    expect(contract.document).toEqual({
      fileName: 'Gobblecube MSA.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 482113,
    })
    expect(contract.extraction?.pages).toBe(13)
    expect(contract.extraction?.fields).toBe(41)
    expect(contract.extraction?.documents.map((d) => [d.type, d.pageStart, d.pageEnd])).toEqual([
      ['msa', 1, 10],
      ['order_form', 11, 12],
      // An unknown document type is shown as Other, not dropped.
      ['other', 13, 13],
    ])
    expect(contract.extraction?.contractType?.value).toBe('new')
    expect(contract.extraction?.contractType?.confidence).toBe(92)
    // A box missing its coordinates is dropped rather than drawn at 0,0.
    expect(contract.extraction?.contractType?.boxes).toHaveLength(1)
    expect(contract.extraction?.toCheck).toEqual({ total: 3, customer: 1, charges: 2, billing: 0 })
  })

  it('maps the 202 body of a fresh upload as queued, with no result', () => {
    const contract = read({
      id: 'ctr_2',
      contract_status: 'draft',
      extraction_status: 'pending',
      document: { file_name: 'a.pdf' },
    })
    expect(contract.extractionStatus).toBe('pending')
    expect(contract.extraction).toBeNull()
    expect(contract.extractionError).toBe('')
  })

  it('keeps the failure reason', () => {
    const contract = read({
      id: 'ctr_3',
      extraction_status: 'failed',
      extraction_error: 'The file has no readable text.',
    })
    expect(contract.extractionStatus).toBe('failed')
    expect(contract.extractionError).toBe('The file has no readable text.')
  })

  it('ignores a result attached to an extraction that has not completed', () => {
    const contract = read({ ...COMPLETED, extraction_status: 'processing' })
    expect(contract.extraction).toBeNull()
  })

  it("reads Go's zero values as unknown: page 0 and an empty term", () => {
    const body = structuredClone(COMPLETED)
    body.extraction.result.documents[0]!.page_start = 0
    body.extraction.result.contract_type.value = ''
    body.extraction.result.contract_type.confidence = 0
    body.extraction.result.contract_type.page = 0
    const contract = read(body)
    expect(contract.extraction?.documents[0]?.pageStart).toBeNull()
    expect(contract.extraction?.contractType?.value).toBeNull()
    expect(contract.extraction?.contractType?.confidence).toBeNull()
    expect(contract.extraction?.contractType?.page).toBeNull()
  })

  it('reads an unknown contract type as no guess', () => {
    const body = structuredClone(COMPLETED)
    body.extraction.result.contract_type.value = 'termination'
    expect(read(body).extraction?.contractType?.value).toBeNull()
  })
})

describe('terms from a real extraction', () => {
  // A completed Gobblecube extraction from a local backend, with the customer's
  // details replaced. It carries the backend's own `to_check`.
  const contract = toUploadedContract(
    fromWire<ContractWire>({
      id: 'ctr_fixture',
      extraction_status: 'completed',
      extraction: { usage: { pages: 13, fields: 45 }, result: RESULT },
    }),
  )
  const extraction = contract.extraction!

  it('reads every term the backend walks, by path', () => {
    const paths = extraction.terms.map((t) => t.path)
    expect(paths[0]).toBe('contract_type')
    expect(paths).toContain('customer.legal_name')
    expect(paths).toContain('charges[0].included_quantity')
    expect(paths).toContain('service_levels[2].description')
    expect(paths.some((p) => p.startsWith('derived.'))).toBe(false)
  })

  it('flags exactly as many terms as the backend counted to check', () => {
    expect(extraction.toCheck.total).toBe(7)
    expect(countContractTermsToCheck(extraction.terms)).toBe(extraction.toCheck.total)
  })

  it('draws a highlight per term with boxes, yellow for the ones to check', () => {
    const highlights = collectContractHighlights(extraction.terms)
    const doubts = highlights.filter((h) => h.tone === 'doubt').map((h) => h.id)
    expect(doubts).toEqual(
      expect.arrayContaining([
        'billing.structure',
        'charges[0].unit',
        'charges[0].included_quantity',
      ]),
    )
    const legal = highlights.find((h) => h.id === 'customer.legal_name')
    expect(legal?.tone).toBe('confident')
    // Read from the cover page and again on the order form.
    expect(legal?.boxes.map((b) => b.page)).toEqual([1, 11])
  })
})
