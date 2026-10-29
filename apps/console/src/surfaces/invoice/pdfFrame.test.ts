import { afterEach, describe, expect, it, vi } from 'vitest'
import { frameablePdf, isPresignedStorageLink } from './pdfFrame'

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
