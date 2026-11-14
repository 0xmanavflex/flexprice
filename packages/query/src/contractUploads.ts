import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AuthSource, getContract, uploadContract } from '@fp/api'
import {
  CONTRACT_TERM_FIELDS,
  type ContractDocumentFile,
  type ContractExtractedTerm,
  type ContractExtraction,
  type ContractTerm,
  type ContractTermBox,
  type ContractType,
  type UploadedContract,
  isContractExtractionActive,
  toContractDocumentType,
  toContractExtractionStatus,
  toContractType,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { credentials, fromWire } from './wire'

/**
 * Contract upload and AI extraction: `POST /contracts/upload`, then
 * `GET /contracts/{id}` until `extraction_status` settles.
 *
 * The shapes below are the backend's JSON after `fromWire` (camelCased):
 * `dto.ContractResponse`, whose `extraction` is the stored
 * `extraction.Extraction` (`internal/ee/agents/extraction/dto.go`). The SDK
 * does not have these fields yet; see `@fp/api` `contractExtraction.ts`.
 */

export interface ContractTermWire {
  value?: unknown
  confidence?: number | null | undefined
  page?: number | null | undefined
  quote?: string | null | undefined
  options?: unknown[] | null | undefined
  note?: string | null | undefined
  boxes?: Partial<ContractTermBox>[] | null | undefined
  derived?: boolean | null | undefined
}

export interface ExtractionResultWire {
  documents?:
    | {
        type?: string | undefined
        title?: string | undefined
        pageStart?: number | null | undefined
        pageEnd?: number | null | undefined
      }[]
    | null
    | undefined
  contractType?: ContractTermWire | null | undefined
  doubts?: unknown[] | null | undefined
  /** The term groups and lists, read by `CONTRACT_TERM_FIELDS`. */
  [group: string]: unknown
  toCheck?:
    | {
        total?: number | undefined
        customer?: number | undefined
        charges?: number | undefined
        billing?: number | undefined
      }
    | null
    | undefined
}

export interface ExtractionWire {
  model?: string | undefined
  jobId?: string | undefined
  usage?:
    | { pages?: number | undefined; fields?: number | undefined; durationSeconds?: number }
    | null
    | undefined
  result?: ExtractionResultWire | null | undefined
}

export interface ContractDocumentWire {
  key?: string | undefined
  fileName?: string | undefined
  mediaType?: string | undefined
  sizeBytes?: number | undefined
  sha256?: string | undefined
}

export interface ContractWire {
  id?: string | undefined
  tenantId?: string | undefined
  environmentId?: string | undefined
  contractStatus?: string | undefined
  document?: ContractDocumentWire | null | undefined
  extractionStatus?: string | undefined
  extractionError?: string | null | undefined
  extraction?: ExtractionWire | null | undefined
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
/**
 * A page number. The backend is Go: an unset int arrives as `0`, not as a
 * missing key, and pages count from 1, so 0 means unknown.
 */
const page = (value: unknown): number | null => {
  const n = num(value)
  return n !== null && n > 0 ? n : null
}

function toBox(box: Partial<ContractTermBox>): ContractTermBox | null {
  const onPage = page(box.page)
  const left = num(box.left)
  const top = num(box.top)
  const width = num(box.width)
  const height = num(box.height)
  return onPage === null || left === null || top === null || width === null || height === null
    ? null
    : { page: onPage, left, top, width, height }
}

export function toContractTerm<T>(
  wire: ContractTermWire,
  readValue: (value: unknown) => T | null,
): ContractTerm<T> {
  // An unset Go string arrives as "": no value, not an empty one.
  const set = wire.value !== '' && wire.value !== null && wire.value !== undefined
  return {
    value: set ? readValue(wire.value) : null,
    confidence: set ? num(wire.confidence) : null,
    page: page(wire.page),
    quote: text(wire.quote),
    options: (wire.options ?? []).filter((o): o is string => typeof o === 'string'),
    note: text(wire.note),
    boxes: (wire.boxes ?? []).map(toBox).filter((b): b is ContractTermBox => b !== null),
    derived: wire.derived === true,
  }
}

/** `fromWire` camelCases keys; the paths stay in the backend's snake_case. */
const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const termValue = (value: unknown): string | null =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : null

/**
 * Every term in a result, by path, in the order the backend walks them
 * (`CONTRACT_TERM_FIELDS`). A missing group or field is skipped.
 */
export function toContractTerms(result: ExtractionResultWire): ContractExtractedTerm[] {
  const terms: ContractExtractedTerm[] = []
  const add = (path: string, wire: unknown) => {
    const fields = record(wire)
    if ('value' in fields || 'confidence' in fields) {
      terms.push({ path, term: toContractTerm(fields as ContractTermWire, termValue) })
    }
  }
  for (const key of CONTRACT_TERM_FIELDS.single) add(key, result[camel(key)])
  for (const [group, keys] of Object.entries(CONTRACT_TERM_FIELDS.groups)) {
    const fields = record(result[camel(group)])
    for (const key of keys) add(`${group}.${key}`, fields[camel(key)])
  }
  for (const [list, keys] of Object.entries(CONTRACT_TERM_FIELDS.lists)) {
    const items = result[camel(list)]
    if (!Array.isArray(items)) continue
    items.forEach((item, index) => {
      const fields = record(item)
      for (const key of keys) add(`${list}[${index}].${key}`, fields[camel(key)])
    })
  }
  return terms
}

function toExtraction(wire: ExtractionWire): ContractExtraction {
  const result = wire.result ?? {}
  const toCheck = result.toCheck ?? {}
  return {
    pages: num(wire.usage?.pages),
    fields: num(wire.usage?.fields),
    documents: (result.documents ?? []).map((doc) => ({
      type: toContractDocumentType(doc.type),
      title: text(doc.title),
      pageStart: page(doc.pageStart),
      pageEnd: page(doc.pageEnd),
    })),
    contractType: result.contractType
      ? toContractTerm<ContractType>(result.contractType, toContractType)
      : null,
    toCheck: {
      total: num(toCheck.total) ?? 0,
      customer: num(toCheck.customer) ?? 0,
      charges: num(toCheck.charges) ?? 0,
      billing: num(toCheck.billing) ?? 0,
    },
    terms: toContractTerms(result),
    doubts: (result.doubts ?? []).filter((d): d is string => typeof d === 'string' && d !== ''),
  }
}

function toDocument(wire: ContractDocumentWire): ContractDocumentFile {
  return {
    fileName: text(wire.fileName),
    mediaType: text(wire.mediaType),
    sizeBytes: num(wire.sizeBytes),
  }
}

export function toUploadedContract(wire: ContractWire): UploadedContract {
  const extractionStatus = toContractExtractionStatus(wire.extractionStatus)
  return {
    id: wire.id ?? '',
    contractStatus: wire.contractStatus ?? '',
    document: wire.document ? toDocument(wire.document) : null,
    extractionStatus,
    extractionError: text(wire.extractionError),
    // Only a completed extraction's result is trusted; a partial one is not shown.
    extraction:
      extractionStatus === 'completed' && wire.extraction ? toExtraction(wire.extraction) : null,
  }
}

export async function fetchUploadedContract(
  serverURL: string,
  auth: AuthSource,
  id: string,
  signal?: AbortSignal,
): Promise<UploadedContract> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view this contract.')
  const body = await getContract(serverURL, token, environmentId, id, signal)
  return toUploadedContract(fromWire<ContractWire>(body))
}

/** How often a contract that is still being read is re-read. */
export const CONTRACT_EXTRACTION_POLL_MS = 2_000
/**
 * Reads before polling stops: about five minutes at the interval above. A
 * typical contract is read in 15–20 seconds; past this the page says it is
 * still working instead of polling forever.
 */
export const CONTRACT_EXTRACTION_MAX_POLLS = 150

/**
 * One uploaded contract, polled while Flexprice AI is reading it.
 *
 * `gaveUp` is true once polling stopped with the extraction still running.
 */
export function useUploadedContract(id: string | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  const key = queryKeys.contractUploads.detail(id ?? '')
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchUploadedContract(serverURL, auth, id ?? '', signal),
    enabled: Boolean(id),
    refetchInterval: (state) => {
      const data = state.state.data
      if (data && !isContractExtractionActive(data.extractionStatus)) return false
      return state.state.dataUpdateCount < CONTRACT_EXTRACTION_MAX_POLLS
        ? CONTRACT_EXTRACTION_POLL_MS
        : false
    },
  })
  // `dataUpdateCount` is not on the hook's result, so it is read off the cache entry.
  const reads = queryClient.getQueryState(key)?.dataUpdateCount ?? 0
  const gaveUp =
    query.data !== undefined &&
    isContractExtractionActive(query.data.extractionStatus) &&
    reads >= CONTRACT_EXTRACTION_MAX_POLLS
  return { ...query, gaveUp }
}

/** Uploads a file and starts extraction; seeds the contract's cache entry with the 202 body. */
export function useUploadContract() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedContract> => {
      const { token, environmentId } = await credentials(auth, 'Sign in to upload a contract.')
      const body = await uploadContract(serverURL, token, environmentId, file, file.name)
      return toUploadedContract(fromWire<ContractWire>(body))
    },
    onSuccess: (contract) => {
      if (contract.id) {
        queryClient.setQueryData(queryKeys.contractUploads.detail(contract.id), contract)
      }
    },
  })
}
