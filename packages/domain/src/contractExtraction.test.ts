import { describe, expect, it } from 'vitest'
import {
  CONTRACT_REVIEW_THRESHOLD,
  type ContractTerm,
  collectContractHighlights,
  contractPageRangeLabel,
  contractTermLabel,
  contractTermNeedsReview,
  contractTermStep,
  countContractTermsToCheck,
  isContractExtractionActive,
  toContractDocumentType,
  toContractExtractionStatus,
  toContractType,
} from './contractExtraction'

describe('contract extraction vocabulary', () => {
  it('reads an unknown status as queued, so the page keeps waiting rather than claiming done', () => {
    expect(toContractExtractionStatus('completed')).toBe('completed')
    expect(toContractExtractionStatus('surprise')).toBe('pending')
    expect(toContractExtractionStatus(undefined)).toBe('pending')
  })

  it('polls only while queued or processing', () => {
    expect(isContractExtractionActive('pending')).toBe(true)
    expect(isContractExtractionActive('processing')).toBe(true)
    expect(isContractExtractionActive('completed')).toBe(false)
    expect(isContractExtractionActive('failed')).toBe(false)
  })

  it('maps unknown document and contract types safely', () => {
    expect(toContractDocumentType('order_form')).toBe('order_form')
    expect(toContractDocumentType('invoice')).toBe('other')
    expect(toContractType('renewal')).toBe('renewal')
    expect(toContractType('termination')).toBeNull()
  })

  it('labels page ranges', () => {
    expect(contractPageRangeLabel(1, 10)).toBe('Pages 1–10')
    expect(contractPageRangeLabel(13, 13)).toBe('Page 13')
    expect(contractPageRangeLabel(4, null)).toBe('Page 4')
    expect(contractPageRangeLabel(null, null)).toBe('')
  })
})

const term = (over: Partial<ContractTerm> = {}): ContractTerm => ({
  value: 'Monthly',
  confidence: 95,
  page: 1,
  quote: '',
  options: [],
  note: '',
  boxes: [{ page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.01 }],
  derived: false,
  ...over,
})

describe('contractTermNeedsReview (mirrors the backend needsCheck)', () => {
  it('flags confidence below the threshold, not at it', () => {
    expect(contractTermNeedsReview(term({ confidence: 89 }))).toBe(true)
    expect(contractTermNeedsReview(term({ confidence: CONTRACT_REVIEW_THRESHOLD }))).toBe(false)
  })

  it('flags terms where the model offered alternatives, even when confident', () => {
    expect(contractTermNeedsReview(term({ options: ['Monthly', 'Quarterly'] }))).toBe(true)
  })

  it('never flags derived or page-less terms', () => {
    expect(contractTermNeedsReview(term({ derived: true, confidence: 10 }))).toBe(false)
    expect(contractTermNeedsReview(term({ page: null, confidence: 10 }))).toBe(false)
  })

  it('does not flag an unset value for low confidence', () => {
    expect(contractTermNeedsReview(term({ value: null, confidence: null }))).toBe(false)
  })
})

describe('contract term paths', () => {
  it('maps paths to the step that confirms them, as the backend stepFor does', () => {
    expect(contractTermStep('customer.legal_name')).toBe('customer')
    expect(contractTermStep('term.notice_days')).toBe('billing')
    expect(contractTermStep('charges[0].billing_period')).toBe('billing')
    expect(contractTermStep('charges[0].amount')).toBe('charges')
    expect(contractTermStep('service_levels[1].description')).toBe('charges')
    expect(contractTermStep('contract_type')).toBeNull()
  })

  it('labels terms for people', () => {
    expect(contractTermLabel('customer.legal_name')).toBe('Legal name')
    expect(contractTermLabel('charges[2].amount')).toBe('Charge 3 · Amount')
    expect(contractTermLabel('service_levels[0].description')).toBe('Service level 1')
  })
})

describe('collectContractHighlights', () => {
  const at = (page: number, top: number) => ({ page, left: 0.1, top, width: 0.2, height: 0.01 })

  it('draws terms with boxes, in reading order, with nested charges', () => {
    const highlights = collectContractHighlights([
      { path: 'charges[1].amount', term: term({ boxes: [at(3, 0.5)] }) },
      { path: 'customer.legal_name', term: term({ boxes: [at(1, 0.2), at(11, 0.4)] }) },
      { path: 'billing.tax', term: term({ boxes: [] }) },
    ])
    expect(highlights.map((h) => h.id)).toEqual(['customer.legal_name', 'charges[1].amount'])
    expect(highlights[0]?.boxes).toHaveLength(2)
    expect(highlights[1]?.label).toBe('Charge 2 · Amount')
  })

  it('colours by review: yellow below the threshold or with options, green otherwise', () => {
    const tones = collectContractHighlights([
      { path: 'billing.currency', term: term({ confidence: 90 }) },
      { path: 'billing.structure', term: term({ confidence: 89, boxes: [at(1, 0.3)] }) },
      { path: 'billing.tax', term: term({ options: ['a', 'b'], boxes: [at(1, 0.4)] }) },
    ]).map((h) => h.tone)
    expect(tones).toEqual(['confident', 'doubt', 'doubt'])
  })

  it('skips derived terms', () => {
    expect(
      collectContractHighlights([{ path: 'derived.end_date', term: term({ derived: true }) }]),
    ).toEqual([])
  })

  it('counts terms to check only on the customer, charges and billing steps', () => {
    const low = term({ confidence: 50 })
    expect(
      countContractTermsToCheck([
        { path: 'contract_type', term: low },
        { path: 'customer.legal_name', term: low },
        { path: 'charges[0].unit', term: low },
      ]),
    ).toBe(2)
  })
})
