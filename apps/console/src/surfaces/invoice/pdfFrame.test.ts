import { afterEach, describe, expect, it, vi } from 'vitest'
import { blobOf, frameablePdf, isPresignedStorageLink, pdfPageCount } from './pdfFrame'

const PRESIGNED = 'https://bucket.s3.amazonaws.com/t/inv.pdf?X-Amz-Signature=abc&X-Amz-Expires=3600'
const PROVIDER = 'https://acme.chargebee.com/invoices/inv_1/pdf'

describe('frameablePdf', () => {
  afterEach(() => vi.restoreAllMocks())

  it('frames a typed blob copy when the PDF can be fetched', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:copy')
    const fetchImpl = vi.fn(async () => new Response('%PDF-1.4', { status: 200 }))
    await expect(frameablePdf(PROVIDER, fetchImpl as never)).resolves.toBe('blob:copy')
    const blob = created.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('application/pdf')
  })

  it('turns the viewer toolbar (and its page counter) off for a one-page PDF', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:copy')
    const onePage = '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R] >>\n2 0 obj << /Type /Page >>'
    const fetchImpl = vi.fn(async () => new Response(onePage, { status: 200 }))
    await expect(frameablePdf(PROVIDER, fetchImpl as never)).resolves.toBe(
      'blob:copy#toolbar=0&navpanes=0',
    )
  })

  it('keeps the toolbar for a PDF of more than one page', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:copy')
    const twoPages = '/Type /Pages /Type /Page /Type/Page'
    const fetchImpl = vi.fn(async () => new Response(twoPages, { status: 200 }))
    await expect(frameablePdf(PROVIDER, fetchImpl as never)).resolves.toBe('blob:copy')
  })

  it('frames a presigned storage link as it is when the fetch is blocked', async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    await expect(frameablePdf(PRESIGNED, fetchImpl as never)).resolves.toBe(PRESIGNED)
  })

  it('does not frame any other link it cannot fetch, since the frame would download it', async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    await expect(frameablePdf(PROVIDER, fetchImpl as never)).resolves.toBeNull()
  })
})

describe('isPresignedStorageLink', () => {
  it('reads the signature from the query', () => {
    expect(isPresignedStorageLink(PRESIGNED)).toBe(true)
    expect(isPresignedStorageLink(PROVIDER)).toBe(false)
    expect(isPresignedStorageLink('not a url')).toBe(false)
  })
})

describe('pdfPageCount', () => {
  it('counts page objects, not the page tree', () => {
    expect(pdfPageCount('/Type /Pages /Type /Page')).toBe(1)
    expect(pdfPageCount('/Type/Page /Type /Page')).toBe(2)
    expect(pdfPageCount('compressed')).toBe(0)
  })
})

describe('blobOf', () => {
  it('drops the viewer parameters so the blob can be revoked', () => {
    expect(blobOf('blob:copy#toolbar=0')).toBe('blob:copy')
    expect(blobOf('blob:copy')).toBe('blob:copy')
  })
})
