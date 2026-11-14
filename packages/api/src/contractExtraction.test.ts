import { afterEach, describe, expect, it, vi } from 'vitest'
import { getContract, uploadContract } from './contractExtraction'
import { ApiError, ErrorKind } from './errors'

const ORIGIN = 'https://us.api.test'

function harness(status: number, body: unknown) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { seen }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadContract', () => {
  it('posts the file as multipart, with the session headers and no JSON content type', async () => {
    const { seen } = harness(202, { id: 'ctr_1', extraction_status: 'pending' })
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' })

    await expect(uploadContract(ORIGIN, 'tok', 'env_1', file, 'msa.pdf')).resolves.toEqual({
      id: 'ctr_1',
      extraction_status: 'pending',
    })

    const sent = seen[0]
    expect(sent?.method).toBe('POST')
    expect(sent?.url).toBe('https://us.api.test/contracts/upload')
    expect(sent?.headers.get('Authorization')).toBe('Bearer tok')
    expect(sent?.headers.get('X-Environment-ID')).toBe('env_1')
    // The browser writes the multipart boundary; a JSON type would break the upload.
    expect(sent?.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/)
    const form = await sent?.formData()
    const part = form?.get('file')
    expect(part).toBeInstanceOf(File)
    expect((part as File).name).toBe('msa.pdf')
  })

  it("surfaces the backend's reason for a rejected file", async () => {
    harness(400, { error: { message: 'Unsupported file type', internal_error: 'x' } })
    const file = new Blob(['PK'], { type: 'application/zip' })

    const error = await uploadContract(ORIGIN, 'tok', 'env_1', file, 'msa.docx').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
  })

  it('refuses to send without an environment', async () => {
    const { seen } = harness(202, {})
    const error = await uploadContract(ORIGIN, 'tok', '', new Blob(), 'a.pdf').catch((e) => e)
    expect((error as ApiError).kind).toBe(ErrorKind.Forbidden)
    expect(seen).toHaveLength(0)
  })
})

describe('getContract', () => {
  it('reads one contract by id', async () => {
    const { seen } = harness(200, { id: 'ctr 1' })
    await getContract(ORIGIN, 'tok', 'env_1', 'ctr 1')
    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe('https://us.api.test/contracts/ctr%201')
  })
})
